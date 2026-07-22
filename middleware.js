// Edge gate for /maloren and /iven — runs on Vercel's edge BEFORE the static files are served.
// Only a request carrying a valid Firebase ID token for the allowed email gets through;
// everyone else is redirected to the home page. (/iven = the self-hosted Iven Forge static export.)
//
// This file runs on the server and is NOT served to browsers, so the values below aren't
// exposed to visitors. (The email is already public in index.html's fallback list anyway,
// and the project id is public in the Firebase config.) No Vercel setup needed — env vars,
// if set, override the defaults.
//
// The main app writes the token to the `__tpk_token` cookie on sign-in (see onIdTokenChanged
// in index.html). Tokens last ~1h and refresh automatically while the app is open.
//
// No external dependencies: the JWT is verified with the built-in Web Crypto API. Cookies are
// parsed from the header (a plain Request has no .cookies helper outside Next.js).

export const config = { matcher: ['/maloren', '/maloren/:path*', '/iven', '/iven/:path*'] };

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tpk-group-8cdc8';
const ALLOWED = (process.env.MALOREN_ALLOWED_EMAIL || 'sthomas131@gmail.com').toLowerCase();
const JWK_URL = 'https://www.googleapis.com/robot/v1/metadata/jwk/securetoken@system.gserviceaccount.com';

let jwksCache = null, jwksExp = 0;
async function getKeys() {
    if (jwksCache && Date.now() < jwksExp) return jwksCache;
    const res = await fetch(JWK_URL);
    const data = await res.json();
    jwksCache = data.keys || [];
    jwksExp = Date.now() + 3600000;
    return jwksCache;
}

function b64urlBytes(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}
function b64urlJson(s) { return JSON.parse(new TextDecoder().decode(b64urlBytes(s))); }

function getCookie(req, name) {
    const raw = req.headers.get('cookie') || '';
    for (const part of raw.split(';')) {
        const eq = part.indexOf('=');
        if (eq === -1) continue;
        if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
    }
    return null;
}

async function verifyToken(token) {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = b64urlJson(parts[0]);
    const payload = b64urlJson(parts[1]);
    const keys = await getKeys();
    const jwk = keys.find(k => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const signed = new TextEncoder().encode(parts[0] + '.' + parts[1]);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(parts[2]), signed);
    if (!ok) return null;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    if (payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`) return null;
    if (payload.aud !== PROJECT_ID) return null;
    return payload;
}

export default async function middleware(req) {
    // Fail safe: only ever act on the gated paths, so nothing here can affect the rest of the site.
    let pathname = '/';
    try { pathname = new URL(req.url).pathname; } catch (e) { return; }
    if (!pathname.startsWith('/maloren') && !pathname.startsWith('/iven')) return;

    const deny = () => Response.redirect(new URL('/?maloren=login', req.url), 302);
    const token = getCookie(req, '__tpk_token');
    if (!token) return deny();
    try {
        const payload = await verifyToken(token);
        if (payload && String(payload.email || '').toLowerCase() === ALLOWED) return;   // allow → serve the file
    } catch (e) { /* fall through to deny */ }
    return deny();
}
