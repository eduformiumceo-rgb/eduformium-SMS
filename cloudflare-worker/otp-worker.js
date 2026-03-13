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
//  1. In Cloudflare Dashboard → Workers & Pages → your OTP worker
//  2. Settings → Variables → KV Namespace Bindings
//     → Binding name: OTP_STORE, KV namespace: otp_store
//  3. Settings → Variables → Secrets:
//     → BREVO_API_KEY = your Brevo API key (Brevo dashboard → API Keys)
//  4. Settings → Variables → Plaintext:
//     → FROM_EMAIL = eduformium.ceo@gmail.com  (your verified Brevo sender)
//  5. Paste this file into your Worker editor and hit Deploy
// ══════════════════════════════════════════════════════════════════

// SECURITY: Set ALLOWED_ORIGIN in Cloudflare Worker environment variables.
// Cloudflare Dashboard → Workers → your worker → Settings → Variables → Add:
//   ALLOWED_ORIGIN = https://your-production-domain.com
// Until then, '*' is used as a safe fallback for local development.
const getCorsHeaders = (env, request) => {
  const allowed = env.ALLOWED_ORIGIN || '*';
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = (allowed === '*' || origin === allowed) ? allowed : 'null';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
};

const json = (data, status = 200, corsHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env) {
    const CORS_HEADERS = getCorsHeaders(env, request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // ── POST /send-otp ──────────────────────────────────────────────
    if (url.pathname === '/send-otp' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, CORS_HEADERS); }

      const { to_name, to_email } = body;
      if (!to_email || !to_name) return json({ error: 'Missing to_name or to_email' }, 400, CORS_HEADERS);

      const email = to_email.toLowerCase().trim();

      // SECURITY: Use crypto.getRandomValues() — a true CSPRNG — instead of Math.random()
      const arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      const otp = String(100000 + (arr[0] % 900000));
      const hash = await sha256(otp);
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      // Store hash in KV — browser never sees the OTP value
      await env.OTP_STORE.put(
        `otp:${email}`,
        JSON.stringify({ hash, expiresAt, attempts: 0 }),
        { expirationTtl: 600 }
      );

      // FIX: Use FROM_EMAIL env variable (your verified Brevo sender)
      // instead of the old hardcoded noreply@eduformium.com which caused the 400 error
      const fromEmail = env.FROM_EMAIL;
      if (!fromEmail) {
        console.error('FROM_EMAIL env variable is not set in Cloudflare Worker settings');
        return json({ error: 'Server misconfiguration: FROM_EMAIL not set' }, 500, CORS_HEADERS);
      }

      // Send email via Brevo
      const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': env.BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'Eduformium SMS', email: fromEmail },
          to: [{ email: to_email, name: to_name }],
          subject: `${otp} is your Eduformium verification code`,
          htmlContent: `
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
        console.error('Brevo send failed. Status:', emailRes.status, '| Response:', JSON.stringify(err));
        return json({ error: 'Failed to send verification email', detail: err.message || String(emailRes.status) }, 500, CORS_HEADERS);
      }

      // Return only success — OTP never leaves the server
      return json({ success: true }, 200, CORS_HEADERS);
    }

    // ── POST /verify-otp ────────────────────────────────────────────
    if (url.pathname === '/verify-otp' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, CORS_HEADERS); }

      const { email, code } = body;
      if (!email || !code) return json({ error: 'Missing email or code' }, 400, CORS_HEADERS);

      const emailKey = `otp:${email.toLowerCase().trim()}`;
      const stored = await env.OTP_STORE.get(emailKey);

      if (!stored) return json({ success: false, reason: 'expired' }, 200, CORS_HEADERS);

      let record;
      try { record = JSON.parse(stored); } catch { return json({ success: false, reason: 'expired' }, 200, CORS_HEADERS); }

      const { hash, expiresAt, attempts } = record;

      if (Date.now() > expiresAt) {
        await env.OTP_STORE.delete(emailKey);
        return json({ success: false, reason: 'expired' }, 200, CORS_HEADERS);
      }

      if (attempts >= 5) {
        await env.OTP_STORE.delete(emailKey);
        return json({ success: false, reason: 'too_many_attempts', attemptsLeft: 0 }, 200, CORS_HEADERS);
      }

      const enteredHash = await sha256(String(code).trim());

      if (enteredHash !== hash) {
        const newAttempts = attempts + 1;
        const attemptsLeft = 5 - newAttempts;

        if (attemptsLeft <= 0) {
          await env.OTP_STORE.delete(emailKey);
          return json({ success: false, reason: 'too_many_attempts', attemptsLeft: 0 }, 200, CORS_HEADERS);
        }

        const ttlSeconds = Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
        await env.OTP_STORE.put(
          emailKey,
          JSON.stringify({ hash, expiresAt, attempts: newAttempts }),
          { expirationTtl: ttlSeconds }
        );

        return json({ success: false, reason: 'wrong_code', attemptsLeft }, 200, CORS_HEADERS);
      }

      // ✅ Correct code — delete immediately so it can't be reused
      await env.OTP_STORE.delete(emailKey);
      return json({ success: true }, 200, CORS_HEADERS);
    }

    return new Response('Not found', { status: 404, headers: getCorsHeaders(env, request) });
  },
};