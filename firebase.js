// ══════════════════════════════════════════
//  EDUFORMIUM SMS — Firebase Integration
//  Plain script — no ES modules
//  Uses Firebase compat SDK from CDN
//
//  SECURITY NOTE: This key is restricted to authorised HTTP referrers
//  in the Firebase Console (API & Services → Credentials).
//  Never commit an unrestricted key to a public repository.
// ══════════════════════════════════════════

const firebaseConfig = {
  apiKey: "AIzaSyC6FBmwn6gSUeb4151QujCn7cuEAk9HR-w",
  authDomain: "eduformium-sms.firebaseapp.com",
  projectId: "eduformium-sms",
  storageBucket: "eduformium-sms.firebasestorage.app",
  messagingSenderId: "190139114687",
  appId: "1:190139114687:web:8f9e343847d367e175520a",
  measurementId: "G-Y68W16CCRH"
};

firebase.initializeApp(firebaseConfig);

const _auth = firebase.auth();
const _db   = firebase.firestore();

_db.enablePersistence({ synchronizeTabs: true }).catch(() => {
  // Offline persistence unavailable (e.g. multiple tabs or private browsing) — app continues normally
});

// ── FDB ──
const FDB = {
  col(sid, name) { return _db.collection('schools').doc(sid).collection(name); },

  async getAll(sid, col) {
    try { const s = await this.col(sid,col).get(); return s.docs.map(d=>({id:d.id,...d.data()})); }
    catch(e){ console.error('getAll',col,e); return []; }
  },

  async set(sid, col, docId, data) {
    try { await this.col(sid,col).doc(docId).set({...data, updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}); return true; }
    catch(e){ console.error('set',col,e); return false; }
  },

  async add(sid, col, data) {
    try { const r = await this.col(sid,col).add({...data, createdAt:firebase.firestore.FieldValue.serverTimestamp()}); return r.id; }
    catch(e){ return null; }
  },

  async delete(sid, col, docId) {
    try { await this.col(sid,col).doc(docId).delete(); return true; }
    catch(e){ return false; }
  },

  async saveSchoolProfile(sid, data) {
    try { await _db.collection('schools').doc(sid).set({...data, updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}); return true; }
    catch(e){ return false; }
  },

  async getSchoolProfile(sid) {
    try { const s = await _db.collection('schools').doc(sid).get(); return s.exists ? s.data() : null; }
    catch(e){ return null; }
  },

  async batchWrite(sid, colName, items) {
    try {
      const CHUNK = 400;
      for (let i = 0; i < items.length; i += CHUNK) {
        const batch = _db.batch();
        items.slice(i, i+CHUNK).forEach(item => {
          const {id, ...data} = item;
          const ref = id ? this.col(sid,colName).doc(String(id)) : this.col(sid,colName).doc();
          batch.set(ref, data, {merge:true});
        });
        await batch.commit();
      }
      return true;
    } catch(e){ console.error('batchWrite',colName,e); return false; }
  },
};

// ── FAuth ──
const FAuth = {
  async register(schoolName, adminName, email, password) {
    try {
      const cred = await _auth.createUserWithEmailAndPassword(email, password);
      const uid  = cred.user.uid;
      await FDB.saveSchoolProfile(uid, {
        name:schoolName, motto:'Excellence in All Things', email,
        currency:'GHS', academicYear:'2025/2026', currentTerm:'2',
        gradeSystem:'percentage', passMark:50, type:'k12',
        adminName, adminEmail:email,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      await FDB.set(uid,'users',uid,{id:uid,name:adminName,email,role:'admin',phone:'',createdAt:new Date().toISOString()});
      return {success:true, uid, user:cred.user};
    } catch(e){ return {success:false, error:this._err(e.code)}; }
  },

  async login(email, password) {
    try {
      const c   = await _auth.signInWithEmailAndPassword(email, password);
      const uid = c.user.uid;

      // ── Check school status before granting access ──
      const schoolDoc = await _db.collection('schools').doc(uid).get();
      const profile   = schoolDoc.exists ? schoolDoc.data() : null;

      if (!profile) {
        await _auth.signOut();
        return { success: false, error: 'School account not found. Please contact support.' };
      }

      if (profile.status === 'suspended') {
        await _auth.signOut();
        return { success: false, error: 'Your account has been suspended. Please contact Eduformium support.' };
      }

      if (profile.status === 'pending') {
        await _auth.signOut();
        return { success: false, error: 'Your account is pending approval. You will be notified once approved.' };
      }

      return { success: true, uid, user: c.user };
    } catch(e) { return { success: false, error: this._err(e.code) }; }
  },

  async logout() {
    try { await _auth.signOut(); return {success:true}; }
    catch(e){ return {success:false}; }
  },

  onAuthChange(cb) {
    return _auth.onAuthStateChanged(async user => {
      if (user) {
        // Re-verify status on every page load / session restore
        try {
          const doc     = await _db.collection('schools').doc(user.uid).get();
          const profile = doc.exists ? doc.data() : null;
          if (!profile || profile.status === 'suspended' || profile.status === 'pending') {
            await _auth.signOut();
            cb(null); // treat as logged-out
            return;
          }
        } catch(e) {
          // Network error — allow cached session to continue rather than locking out
        }
      }
      cb(user);
    });
  },

  _err(code) {
    const m = {
      'auth/user-not-found':'No account found with this email.',
      'auth/wrong-password':'Incorrect password. Please try again.',
      'auth/invalid-credential':'Incorrect email or password.',
      'auth/email-already-in-use':'This email is already registered.',
      'auth/weak-password':'Password must be at least 6 characters.',
      'auth/invalid-email':'Please enter a valid email address.',
      'auth/too-many-requests':'Too many attempts. Please try again later.',
      'auth/network-request-failed':'Network error. Check your connection.',
    };
    return m[code] || 'Something went wrong. Please try again.';
  },
};

// ── Migration ──
const Migration = {
  async run(sid) {
    if (localStorage.getItem('sms_firebase_migrated_'+sid)) return;
    console.log('🔄 Migrating to Firestore...');
    const cols = ['students','staff','classes','subjects','feePayments','feeStructure',
      'exams','grades','attendance','events','messages','leaves','homework','books','expenses','payroll','auditLog'];
    for (const col of cols) {
      try {
        const raw = localStorage.getItem('sms_'+col);
        if (raw) { const items = JSON.parse(raw); if(Array.isArray(items)&&items.length>0) await FDB.batchWrite(sid,col,items); }
      } catch(e){}
    }
    const school = localStorage.getItem('sms_school');
    if (school) { try { await FDB.saveSchoolProfile(sid, JSON.parse(school)); } catch(e){} }
    localStorage.setItem('sms_firebase_migrated_'+sid,'true');
    console.log('✅ Migration complete!');
  }
};

window.FDB = FDB;
window.FAuth = FAuth;
window.Migration = Migration;
