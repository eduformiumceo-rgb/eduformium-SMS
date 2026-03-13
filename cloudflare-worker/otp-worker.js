// ══════════════════════════════════════════════════════════════════
//  EDUFORMIUM SMS — Cloudflare Worker: Server-Side OTP
//
//  SECURITY FIXES IMPLEMENTED:
//  - F-05: OTP is generated HERE (server-side), never in the browser
//  - F-06: Hash is stored in KV, never returned to the browser
//  - Brute force: 5 attempt limit enforced server-side in KV
//  - Replay: OTP deleted from KV immediately after successful verify
//
//  DEPLOY STEPS:
//  1. In Cloudflare Dashboard → Workers & Pages → your worker
//  2. Go to Settings → Variables → KV Namespace Bindings
//  3. Add binding: Variable name = OTP_STORE, KV namespace = (create one called "otp_store")
//  4. Add Secret: RESEND_API_KEY = your Resend API key
//  5. Replace the worker code with this file
// ══════════════════════════════════════════════════════════════════

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });

// SHA-256 hash — same algorithm as the browser app uses for passwords
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // ── POST /send-otp ──────────────────────────────────────────────
    // Generates the OTP server-side, stores its hash in KV, emails the code.
    // The browser never receives the OTP value.
    if (url.pathname === '/send-otp' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

      const { to_name, to_email } = body;
      if (!to_email || !to_name) return json({ error: 'Missing to_name or to_email' }, 400);

      const email = to_email.toLowerCase().trim();

      // Generate a 6-digit OTP entirely server-side
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const hash = await sha256(otp);
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      // Store {hash, expiresAt, attempts} in KV — auto-expires after 10 minutes
      await env.OTP_STORE.put(
        `otp:${email}`,
        JSON.stringify({ hash, expiresAt, attempts: 0 }),
        { expirationTtl: 600 }
      );

      // Send email via Resend
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Eduformium SMS <noreply@eduformium.com>',
          to: [to_email],
          subject: `${otp} is your Eduformium verification code`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px">
              <h2 style="color:#1e3a5f;margin-bottom:8px">Verify your email</h2>
              <p style="color:#444;margin-bottom:24px">Hi ${to_name}, enter this code to complete your school registration:</p>
              <div style="background:#f4f6f8;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
                <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#1e3a5f">${otp}</span>
              </div>
              <p style="color:#888;font-size:13px">This code expires in <strong>10 minutes</strong> and can only be used once.</p>
              <p style="color:#888;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
            </div>
          `,
        }),
      });

      if (!emailRes.ok) {
        const err = await emailRes.json().catch(() => ({}));
        console.error('Resend error:', err);
        return json({ error: 'Failed to send verification email' }, 500);
      }

      // Return only success — OTP never leaves the server
      return json({ success: true });
    }

    // ── POST /verify-otp ────────────────────────────────────────────
    // Checks the entered code against the KV-stored hash.
    // Enforces attempt limit and expiry server-side.
    if (url.pathname === '/verify-otp' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

      const { email, code } = body;
      if (!email || !code) return json({ error: 'Missing email or code' }, 400);

      const emailKey = `otp:${email.toLowerCase().trim()}`;
      const stored = await env.OTP_STORE.get(emailKey);

      if (!stored) {
        return json({ success: false, reason: 'expired' });
      }

      let record;
      try { record = JSON.parse(stored); } catch { return json({ success: false, reason: 'expired' }); }

      const { hash, expiresAt, attempts } = record;

      // Check expiry
      if (Date.now() > expiresAt) {
        await env.OTP_STORE.delete(emailKey);
        return json({ success: false, reason: 'expired' });
      }

      // Check attempt limit
      if (attempts >= 5) {
        await env.OTP_STORE.delete(emailKey);
        return json({ success: false, reason: 'too_many_attempts', attemptsLeft: 0 });
      }

      // Hash the entered code and compare
      const enteredHash = await sha256(String(code).trim());

      if (enteredHash !== hash) {
        const newAttempts = attempts + 1;
        const attemptsLeft = 5 - newAttempts;

        if (attemptsLeft <= 0) {
          // Max attempts reached — delete so they must request a new code
          await env.OTP_STORE.delete(emailKey);
          return json({ success: false, reason: 'too_many_attempts', attemptsLeft: 0 });
        }

        // Update attempt count in KV
        const ttlSeconds = Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
        await env.OTP_STORE.put(
          emailKey,
          JSON.stringify({ hash, expiresAt, attempts: newAttempts }),
          { expirationTtl: ttlSeconds }
        );

        return json({ success: false, reason: 'wrong_code', attemptsLeft });
      }

      // ✅ Correct code — delete immediately so it can't be reused
      await env.OTP_STORE.delete(emailKey);
      return json({ success: true });
    }

    return new Response('Not found', { status: 404, headers: CORS_HEADERS });
  },
};
