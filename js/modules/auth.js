// ══════════════════════════════════════════════════════════════════
//  EDUFORMIUM SMS — Cloudflare Worker: Server-Side OTP
//
//  SECURITY FIXES IMPLEMENTED:
//  - F-05: OTP is generated HERE (server-side), never in the browser
//  - F-06: Hash is stored in KV, never returned to the browser
//  - Brute force: 5 attempt limit enforced server-side in KV
//  - Replay: OTP deleted from KV immediately after successful verify
//
//  BUG FIX (v2): Added the 3 missing password reset routes:
//  - /send-reset-otp    (was returning 404 — broke entire reset flow)
//  - /verify-reset-otp  (was returning 404 — broke OTP verification)
//  - /apply-password-reset (was returning 404 — no password ever updated)
//
//  DEPLOY STEPS:
//  1. In Cloudflare Dashboard → Workers & Pages → your OTP worker
//     (Deploy BOTH your DEV worker AND your PROD worker with this same file)
//  2. Settings → Variables → KV Namespace Bindings
//     → Binding name: OTP_STORE, KV namespace: otp_store
//  3. Settings → Variables → Secrets:
//     → BREVO_API_KEY        = your Brevo API key
//     → SUPABASE_URL         = https://<your-project>.supabase.co
//     → SUPABASE_SERVICE_ROLE_KEY = your Supabase service_role key  ← NEW (needed for /apply-password-reset)
//       (also accepted as SUPABASE_SERVICE_KEY — either name works)
//  4. Settings → Variables → Plaintext:
//     → FROM_EMAIL      = your verified Brevo sender email
//     → ALLOWED_ORIGIN  = https://your-production-domain.com
//  5. Paste this file into your Worker editor and hit Deploy
//
//  KEY DIFFERENCES BETWEEN DEV AND PROD WORKERS:
//  - Different KV namespaces (otp_store_dev vs otp_store_prod)
//  - Different SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY secrets
//  - Different ALLOWED_ORIGIN values
//  - The worker CODE itself is identical — only the secrets differ
// ══════════════════════════════════════════════════════════════════

const getCorsHeaders = (env, request) => {
  const allowed = env.ALLOWED_ORIGIN || '*';
  const origin = request.headers.get('Origin') || '';
  // Wildcard: allow all origins (dev / no ALLOWED_ORIGIN set)
  if (allowed === '*') {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
  }
  // Origin matches the configured domain: grant access
  if (origin === allowed) {
    return {
      'Access-Control-Allow-Origin': allowed,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
  }
  // Origin does NOT match: omit ACAO header entirely so the browser blocks the request.
  // Sending the string "null" would accidentally permit sandboxed iframes and file:// pages.
  return {
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

      // Rate limit: max 5 registration OTP sends per 30 minutes per email.
      // Check the counter first — do NOT write until we know the send succeeded.
      const rlKey = `reg_rl:${email}`;
      const rlRaw = await env.OTP_STORE.get(rlKey);
      let rl;
      try { rl = rlRaw ? JSON.parse(rlRaw) : { count: 0, windowStart: Date.now() }; }
      catch { rl = { count: 0, windowStart: Date.now() }; }

      // Reset window if expired
      if (Date.now() - rl.windowStart >= 30 * 60 * 1000) {
        rl = { count: 0, windowStart: Date.now() };
      }
      if (rl.count >= 5) {
        return json({ success: false, reason: 'rate_limited' }, 200, CORS_HEADERS);
      }

      // Validate FROM_EMAIL before generating or storing anything — fail fast.
      const fromEmail = env.FROM_EMAIL;
      if (!fromEmail) {
        console.error('FROM_EMAIL env variable is not set in Cloudflare Worker settings');
        return json({ error: 'Server misconfiguration: FROM_EMAIL not set' }, 500, CORS_HEADERS);
      }

      const arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      const otp = String(100000 + (arr[0] % 900000));
      const hash = await sha256(otp);
      const expiresAt = Date.now() + 10 * 60 * 1000;

      await env.OTP_STORE.put(
        `otp:${email}`,
        JSON.stringify({ hash, expiresAt, attempts: 0 }),
        { expirationTtl: 600 }
      );

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

      // Only increment rate limit counter after confirmed successful send.
      // This prevents a Brevo outage from burning through a legitimate user's attempts.
      rl.count++;
      await env.OTP_STORE.put(rlKey, JSON.stringify(rl), { expirationTtl: 1800 });

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

    // ══════════════════════════════════════════════════════════════
    //  BUG FIX: The 3 routes below were COMPLETELY MISSING from the
    //  original worker. Auth.js called them, the worker returned 404,
    //  and the entire password reset flow was silently broken.
    // ══════════════════════════════════════════════════════════════

    // ── POST /send-reset-otp ────────────────────────────────────────
    if (url.pathname === '/send-reset-otp' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, CORS_HEADERS); }

      const { email } = body;
      if (!email) return json({ error: 'Missing email' }, 400, CORS_HEADERS);

      const emailNorm = email.toLowerCase().trim();

      // Rate limit: max 3 sends per 30 minutes per email address
      const rlKey = `reset_rl:${emailNorm}`;
      const rlRaw = await env.OTP_STORE.get(rlKey);
      let rl;
      try { rl = rlRaw ? JSON.parse(rlRaw) : { count: 0, windowStart: Date.now() }; }
      catch { rl = { count: 0, windowStart: Date.now() }; }

      // Reset window if expired
      if (Date.now() - rl.windowStart >= 30 * 60 * 1000) {
        rl = { count: 0, windowStart: Date.now() };
      }
      if (rl.count >= 3) {
        return json({ success: false, reason: 'rate_limited' }, 200, CORS_HEADERS);
      }

      // Validate FROM_EMAIL before generating or storing anything — fail fast.
      const fromEmail = env.FROM_EMAIL;
      if (!fromEmail) {
        console.error('FROM_EMAIL env variable is not set');
        return json({ error: 'Server misconfiguration: FROM_EMAIL not set' }, 500, CORS_HEADERS);
      }

      // Check if this email exists in Supabase Auth before generating or storing anything.
      const supabaseUrl = env.SUPABASE_URL;
      const serviceKey  = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
      if (supabaseUrl && serviceKey) {
        try {
          const userRes = await fetch(
            `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(emailNorm)}&per_page=10`,
            { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
          );
          const userData = await userRes.json();
          const emailExists = Array.isArray(userData.users) &&
            userData.users.some(u => u.email === emailNorm);
          if (!emailExists) {
            return json({ success: false, reason: 'user_not_found' }, 200, CORS_HEADERS);
          }
        } catch(e) {
          // Admin API check failed — proceed so a transient error never blocks a real user.
          console.error('Email existence check failed:', e);
        }
      }

      // Email confirmed — now generate OTP server-side (browser never sees this value)
      const arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      const otp = String(100000 + (arr[0] % 900000));
      const hash = await sha256(otp);
      const expiresAt = Date.now() + 10 * 60 * 1000;

      // Store hash in KV under reset namespace (separate from registration OTPs)
      await env.OTP_STORE.put(
        `reset_otp:${emailNorm}`,
        JSON.stringify({ hash, expiresAt, attempts: 0 }),
        { expirationTtl: 600 }
      );

      const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': env.BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'Eduformium SMS', email: fromEmail },
          to: [{ email: emailNorm }],
          subject: `${otp} is your Eduformium password reset code`,
          htmlContent: `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px">
              <h2 style="color:#1e3a5f;margin-bottom:8px">Reset your password</h2>
              <p style="color:#444;margin-bottom:24px">Enter this code to reset your Eduformium password:</p>
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
        console.error('Brevo reset OTP send failed:', emailRes.status, JSON.stringify(err));
        return json({ success: false, reason: 'send_failed' }, 200, CORS_HEADERS);
      }

      // Only increment rate limit counter after confirmed successful send.
      rl.count++;
      await env.OTP_STORE.put(rlKey, JSON.stringify(rl), { expirationTtl: 1800 });

      return json({ success: true }, 200, CORS_HEADERS);
    }

    // ── POST /verify-reset-otp ──────────────────────────────────────
    if (url.pathname === '/verify-reset-otp' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, CORS_HEADERS); }

      const { email, code } = body;
      if (!email || !code) return json({ error: 'Missing email or code' }, 400, CORS_HEADERS);

      const emailNorm = email.toLowerCase().trim();
      const otpKey = `reset_otp:${emailNorm}`;
      const stored = await env.OTP_STORE.get(otpKey);

      if (!stored) return json({ success: false, reason: 'expired' }, 200, CORS_HEADERS);

      let record;
      try { record = JSON.parse(stored); } catch { return json({ success: false, reason: 'expired' }, 200, CORS_HEADERS); }

      const { hash, expiresAt, attempts } = record;

      if (Date.now() > expiresAt) {
        await env.OTP_STORE.delete(otpKey);
        return json({ success: false, reason: 'expired' }, 200, CORS_HEADERS);
      }

      if (attempts >= 5) {
        await env.OTP_STORE.delete(otpKey);
        return json({ success: false, reason: 'too_many_attempts', attemptsLeft: 0 }, 200, CORS_HEADERS);
      }

      const enteredHash = await sha256(String(code).trim());

      if (enteredHash !== hash) {
        const newAttempts = attempts + 1;
        const attemptsLeft = 5 - newAttempts;

        if (attemptsLeft <= 0) {
          await env.OTP_STORE.delete(otpKey);
          return json({ success: false, reason: 'too_many_attempts', attemptsLeft: 0 }, 200, CORS_HEADERS);
        }

        const ttlSeconds = Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
        await env.OTP_STORE.put(
          otpKey,
          JSON.stringify({ hash, expiresAt, attempts: newAttempts }),
          { expirationTtl: ttlSeconds }
        );

        return json({ success: false, reason: 'wrong_code', attemptsLeft }, 200, CORS_HEADERS);
      }

      // ✅ Correct code — delete OTP immediately (one-time use)
      await env.OTP_STORE.delete(otpKey);

      // Issue a cryptographically random one-time reset_token.
      // The TOKEN is returned to the browser; only its HASH is stored in KV.
      // This means the KV value alone is useless to an attacker even if KV is read.
      const tokenBytes = new Uint8Array(32);
      crypto.getRandomValues(tokenBytes);
      const reset_token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      const tokenHash = await sha256(reset_token);

      // Valid for 15 minutes — enough time to type a new password
      await env.OTP_STORE.put(
        `reset_token:${emailNorm}`,
        JSON.stringify({ tokenHash, expiresAt: Date.now() + 15 * 60 * 1000 }),
        { expirationTtl: 900 }
      );

      return json({ success: true, reset_token }, 200, CORS_HEADERS);
    }

    // ── POST /apply-password-reset ──────────────────────────────────
    if (url.pathname === '/apply-password-reset' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, CORS_HEADERS); }

      const { email, reset_token, new_password } = body;
      if (!email || !reset_token || !new_password) {
        return json({ success: false, reason: 'update_failed' }, 200, CORS_HEADERS);
      }

      // Validate password length before touching KV or Supabase
      if (new_password.length < 8)   return json({ success: false, reason: 'password_too_short' }, 200, CORS_HEADERS);
      if (new_password.length > 128) return json({ success: false, reason: 'update_failed' }, 200, CORS_HEADERS);

      const emailNorm = email.toLowerCase().trim();
      const tokenKey = `reset_token:${emailNorm}`;
      const stored = await env.OTP_STORE.get(tokenKey);

      if (!stored) return json({ success: false, reason: 'token_expired' }, 200, CORS_HEADERS);

      let record;
      try { record = JSON.parse(stored); } catch { return json({ success: false, reason: 'token_expired' }, 200, CORS_HEADERS); }

      const { tokenHash, expiresAt } = record;

      if (Date.now() > expiresAt) {
        await env.OTP_STORE.delete(tokenKey);
        return json({ success: false, reason: 'token_expired' }, 200, CORS_HEADERS);
      }

      // Verify the submitted token by hashing and comparing — constant-time equivalent
      const submittedHash = await sha256(reset_token);
      if (submittedHash !== tokenHash) {
        return json({ success: false, reason: 'invalid_token' }, 200, CORS_HEADERS);
      }

      // Call Supabase Admin API to update the user's password
      const supabaseUrl = env.SUPABASE_URL;
      // Accept both naming conventions — SUPABASE_SERVICE_ROLE_KEY (Supabase standard) and
      // SUPABASE_SERVICE_KEY (legacy). Whichever one is set in Cloudflare secrets will work.
      const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in worker secrets');
        // NOTE: token is NOT deleted here — misconfiguration is not the user's fault.
        // They can try again once the server is fixed without restarting the whole flow.
        return json({ success: false, reason: 'server_misconfiguration' }, 200, CORS_HEADERS);
      }

      // Look up the Supabase user ID by email.
      // Use both ?filter= (GoTrue standard) and ?email= (some Supabase versions) for compatibility.
      const listRes = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(emailNorm)}&email=${encodeURIComponent(emailNorm)}&per_page=10`,
        {
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            apikey: supabaseServiceKey,
          },
        }
      );

      if (!listRes.ok) {
        console.error('Supabase user lookup failed:', listRes.status);
        // Do NOT delete token on transient Supabase error — user can retry without restarting flow
        return json({ success: false, reason: 'update_failed' }, 200, CORS_HEADERS);
      }

      const listData = await listRes.json();
      // SAFETY: always verify the returned user's email matches exactly.
      // This guards against the ?filter= param not working and returning a different user.
      const users = listData?.users || [];
      const user = users.find(u => u.email?.toLowerCase() === emailNorm);
      if (!user) {
        return json({ success: false, reason: 'user_not_found' }, 200, CORS_HEADERS);
      }

      // Update the password via Supabase Admin API
      const updateRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: new_password }),
      });

      if (!updateRes.ok) {
        const err = await updateRes.json().catch(() => ({}));
        console.error('Supabase password update failed:', updateRes.status, JSON.stringify(err));
        // Do NOT delete token on transient Supabase error — user can retry without restarting flow
        return json({ success: false, reason: 'update_failed' }, 200, CORS_HEADERS);
      }

      // ✅ Password updated successfully — NOW delete the token (one-time use, prevents replay).
      // Deleting AFTER success means transient Supabase errors don't consume the token,
      // so the user can retry without restarting the entire 3-screen reset flow.
      await env.OTP_STORE.delete(tokenKey);

      return json({ success: true }, 200, CORS_HEADERS);
    }

    // ── POST /check-email ───────────────────────────────────────────
    // Used by the sign-in page to show "email not registered" vs "wrong password".
    // Rate limited: 10 checks per 5 minutes per email to prevent bulk enumeration.
    if (url.pathname === '/check-email' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, CORS_HEADERS); }

      const { email } = body;
      if (!email) return json({ error: 'Missing email' }, 400, CORS_HEADERS);

      const emailNorm = email.toLowerCase().trim();

      // Rate limit: 10 checks per 5 min per email
      const rlKey = `check_email_rl:${emailNorm}`;
      const rlRaw = await env.OTP_STORE.get(rlKey).catch(() => null);
      let rl;
      try { rl = rlRaw ? JSON.parse(rlRaw) : { count: 0, windowStart: Date.now() }; }
      catch { rl = { count: 0, windowStart: Date.now() }; }
      if (Date.now() - rl.windowStart >= 5 * 60 * 1000) {
        rl = { count: 0, windowStart: Date.now() };
      }
      if (rl.count >= 10) {
        // Rate limited — return exists:true (safe fallback, won't show false "not found")
        return json({ exists: true }, 200, CORS_HEADERS);
      }
      rl.count++;
      await env.OTP_STORE.put(rlKey, JSON.stringify(rl), { expirationTtl: 300 }).catch(() => {});

      const supabaseUrl = env.SUPABASE_URL;
      const serviceKey  = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;

      if (!supabaseUrl || !serviceKey) {
        // Config missing — safe fallback: don't show false "not found"
        return json({ exists: true }, 200, CORS_HEADERS);
      }

      try {
        const res = await fetch(
          `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(emailNorm)}&per_page=10`,
          { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
        );
        const data = await res.json();
        const exists = Array.isArray(data.users) &&
          data.users.some(u => u.email === emailNorm);
        return json({ exists }, 200, CORS_HEADERS);
      } catch(e) {
        console.error('check-email Admin API error:', e);
        // On error: safe fallback — don't falsely tell user their email isn't registered
        return json({ exists: true }, 200, CORS_HEADERS);
      }
    }

    return new Response('Not found', { status: 404, headers: CORS_HEADERS });
  },
};