// ══════════════════════════════════════════════════════════════
//  EDUFORMIUM SMS — Cloud Functions
//  Handles sub-user Firebase Auth account management.
//
//  Deploy to DEV:  npm run deploy:dev
//  Deploy to PROD: npm run deploy:prod
//  Deploy BOTH:    npm run deploy:all
// ══════════════════════════════════════════════════════════════

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// ── Helper: verify caller is an admin of the given school ──
async function verifyAdmin(auth, schoolId) {
  if (!auth) throw new HttpsError('unauthenticated', 'You must be logged in.');
  if (!schoolId) throw new HttpsError('invalid-argument', 'schoolId is required.');

  // Owner (Firebase Auth uid === schoolId) is always admin
  if (auth.uid === schoolId) return true;

  // Otherwise check the users sub-collection
  const userDoc = await db
    .collection('schools').doc(schoolId)
    .collection('users').doc(auth.uid)
    .get();

  if (!userDoc.exists || userDoc.data().role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only admins can manage users.');
  }
  return true;
}

// ══════════════════════════════════════════════════════════════
//  createSubUser
//  Called by the app when an admin adds a new user in Settings.
//
//  Payload: { schoolId, email, password, name, role, userId }
//  Returns: { success: true }
// ══════════════════════════════════════════════════════════════
exports.createSubUser = onCall(async (request) => {
  const { schoolId, email, password, name, role, userId } = request.data;
  await verifyAdmin(request.auth, schoolId);

  if (!email || !password || !name || !role || !userId) {
    throw new HttpsError('invalid-argument', 'Missing required fields.');
  }
  if (password.length < 8) {
    throw new HttpsError('invalid-argument', 'Password must be at least 8 characters.');
  }

  try {
    // Create the Firebase Auth account
    const userRecord = await admin.auth().createUser({
      uid:         userId,   // use the same ID already saved in Firestore
      email:       email,
      password:    password,
      displayName: name,
    });

    // Write a custom claim so security rules can identify school membership
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      schoolId: schoolId,
      role:     role,
    });

    // Write to top-level userIndex for login lookup
    await db.collection('userIndex').doc(_emailKey(email)).set({
      email:     email.toLowerCase(),
      schoolId:  schoolId,
      userId:    userId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (e) {
    // If the Auth account already exists, just update claims & index
    if (e.code === 'auth/uid-already-exists' || e.code === 'auth/email-already-exists') {
      try {
        await admin.auth().setCustomUserClaims(userId, { schoolId, role });
        await db.collection('userIndex').doc(_emailKey(email)).set({
          email: email.toLowerCase(), schoolId, userId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true };
      } catch (e2) {
        throw new HttpsError('internal', e2.message);
      }
    }
    throw new HttpsError('internal', e.message);
  }
});

// ══════════════════════════════════════════════════════════════
//  deleteSubUser
//  Called by the app when an admin deletes a user in Settings.
//
//  Payload: { schoolId, userId, email }
//  Returns: { success: true }
// ══════════════════════════════════════════════════════════════
exports.deleteSubUser = onCall(async (request) => {
  const { schoolId, userId, email } = request.data;
  await verifyAdmin(request.auth, schoolId);

  if (!userId) throw new HttpsError('invalid-argument', 'userId is required.');

  // Delete Firebase Auth account (ignore if already gone)
  try { await admin.auth().deleteUser(userId); } catch (e) {}

  // Remove from userIndex
  if (email) {
    try { await db.collection('userIndex').doc(_emailKey(email)).delete(); } catch (e) {}
  }

  return { success: true };
});

// ── Shared helper ──
function _emailKey(email) {
  return email.toLowerCase().replace(/[.@]/g, '_');
}
