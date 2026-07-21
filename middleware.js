// Edge gate for /maloren — runs on Vercel's edge BEFORE the static file is served.
// Only a request carrying a valid Firebase ID token for the allowed email gets through;
// everyone else is redirected to the home page. The allowed email + project id live in
// Vercel environment variables (NOT in this source), so the identity isn't in the code.
//
// Required Vercel env vars:
//   FIREBASE_PROJECT_ID      (already set for build.sh)
//   MALOREN_ALLOWED_EMAIL    e.g. sthomas131@gmail.com
//
// The main app writes the token to the `__tpk_token` cookie on sign-in (see onIdTokenChanged
// in index.html). Firebase tokens last ~1h and refresh automatically while the app is open.

import { jwtVerify, createRemoteJWKSet } from 'jose';

export const config = { matcher: ['/maloren', '/maloren/', '/maloren/:path*'] };

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const ALLOWED = (process.env.MALOREN_ALLOWED_EMAIL || '').toLowerCase();
// Firebase signs ID tokens with Google's securetoken keys (published as a JWK set).
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/robot/v1/metadata/jwk/securetoken@system.gserviceaccount.com'));

export default async function middleware(req) {
    const deny = () => Response.redirect(new URL('/?maloren=login', req.url), 302);
    if (!PROJECT_ID || !ALLOWED) return deny();   // misconfigured → fail closed
    const token = req.cookies.get('__tpk_token')?.value;
    if (!token) return deny();
    try {
        const { payload } = await jwtVerify(token, JWKS, {
            issuer: `https://securetoken.google.com/${PROJECT_ID}`,
            audience: PROJECT_ID,
        });
        const email = String(payload.email || '').toLowerCase();
        if (email && email === ALLOWED) return undefined;   // verified as the owner → serve the file
    } catch (e) { /* invalid/expired token → deny */ }
    return deny();
}
