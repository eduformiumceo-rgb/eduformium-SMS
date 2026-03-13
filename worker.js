// ══════════════════════════════════════════════════════════════════
//  EDUFORMIUM SMS — Cloudflare Worker entry point
// ══════════════════════════════════════════════════════════════════

function generateNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function buildSecurityHeaders(nonce) {
  return {
    'X-Frame-Options':           'DENY',
    'X-Content-Type-Options':    'nosniff',
    'Referrer-Policy':           'strict-origin-when-cross-origin',
    'Permissions-Policy':        'camera=(), microphone=(), geolocation=(), payment=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Content-Security-Policy':   [
      "default-src 'none'",
      `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' cdn.jsdelivr.net cdnjs.cloudflare.com`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src https://fonts.gstatic.com data:",
      "img-src 'self' data: blob:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://eduformium-otp.school-management.workers.dev https://cdnjs.cloudflare.com",
      "worker-src 'self'",
      "manifest-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; '),
  };
}

function applySecurityHeaders(response, nonce) {
  const headers = buildSecurityHeaders(nonce);
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) {
    newHeaders.set(key, value);
  }
  return new Response(response.body, {
    status:     response.status,
    statusText: response.statusText,
    headers:    newHeaders,
  });
}

async function injectNonceIntoHTML(response, nonce) {
  const headers = buildSecurityHeaders(nonce);
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) {
    newHeaders.set(key, value);
  }
  newHeaders.set('Content-Type', 'text/html; charset=utf-8');

  // Inject nonce into all <script> tags so they pass CSP
  const text = await response.text();
  const patched = text.replace(/<script(?![^>]*\bnonce=)/gi, `<script nonce="${nonce}"`);

  return new Response(patched, {
    status:  response.status,
    headers: newHeaders,
  });
}

export default {
  async fetch(request, env, ctx) {
    const url   = new URL(request.url);
    const nonce = generateNonce();

    // Serve runtime config — keys come from Worker Secrets, never source code
    if (url.pathname === '/config.js') {
      const config = {
        dev:  { url: 'https://yayfpzjvdckyeaimvbwu.supabase.co', anonKey: env.DEV_SUPABASE_ANON_KEY  || '' },
        prod: { url: 'https://czfhqqqnjprxwrlwmkox.supabase.co', anonKey: env.PROD_SUPABASE_ANON_KEY || '' },
      };
      const headers = buildSecurityHeaders(nonce);
      return new Response(
        `window.APP_CONFIG = ${JSON.stringify(config)};`,
        {
          headers: {
            ...headers,
            'Content-Type':  'application/javascript; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    const response = await env.ASSETS.fetch(request);
    const contentType = response.headers.get('Content-Type') || '';

    // Inject nonce into HTML responses for stronger CSP
    if (contentType.includes('text/html')) {
      return injectNonceIntoHTML(response, nonce);
    }

    return applySecurityHeaders(response, nonce);
  },
};