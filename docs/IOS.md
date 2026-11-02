# Taverning for iOS

**Approach.** A Capacitor 7 shell (`ios/`) loads the live site (`https://taverning.com/sessions`), so auth, API routes and data stay one codebase. Native plugins run through the Capacitor bridge from `components/native-bridge.tsx`. That file does nothing in a normal browser. Bundling the site isn't possible because the app relies on server routes.

**What makes it native (Guideline 4.2):**
- Native APNs push: poll is up, game tomorrow, Previously on is ready. Tapping a notification deep-links inside the app.
- Universal links: `taverning.com/join/*`, `/invite/*`, `/polls/*` and others open in the app (`/.well-known/apple-app-site-association`).
- Haptics on taps, a native splash screen, a status bar that follows the theme, and safe areas (`viewport-fit=cover`).
- No pinch or focus zoom (site-wide viewport lock, kept by Seth's decision 2026-11-01), no text selection or callouts outside inputs, no rubber-band overscroll, and an offline screen.
- Bottom tab bar (Sessions / Campaigns / Almanac / Polls / Invites) is the only navigation in the app at every width, with selection haptics.
- Native iOS share sheet (`@capacitor/share`, `lib/native-share.ts`) for invite and poll links.
- Icon and splash come from the Taverning d20 mark (`node scripts/ios-assets.mjs` rebuilds them).
- Sign in with Apple on the sign-in screen (app only): native Apple sheet via `@capacitor-community/apple-sign-in`, then Firebase `signInWithCredential` with the `apple.com` provider and a SHA-256 nonce (`lib/apple-sign-in.ts`). Needs the Apple provider enabled in Firebase Auth (tpk-group-8cdc8). An Apple account with a hidden relay email is a separate Taverning account from an email sign-in.
- Still nice before App Store review: native date picker and action sheets, and a notification settings screen. TestFlight builds are fine without these.

**Build.** `.github/workflows/ios.yml` runs on GitHub's macOS runners. With no signing secrets it builds an unsigned simulator app as a smoke test. When the secrets are present, a manual run signs the app, archives it and uploads it to TestFlight. It never runs on pushes to main.

**Push sender:** `lib/apns.ts` (HTTP/2, ES256 token auth) and `lib/push.ts` read tokens from `users/{uid}/devices` and drop dead ones (410). `api/cron/reminders` pushes the same 3-day / 3-hour reminders. It does nothing until Vercel has `APNS_KEY_ID`, `APNS_KEY_P8` (the .p8 text) and `APPLE_TEAM_ID` (`APNS_SANDBOX=1` for dev builds). Still to wire: poll-created and Previously-on pushes.

**GitHub secrets the workflow needs** (same names as Dating Throw): `APPLE_TEAM_ID`, `BUILD_CERTIFICATE_BASE64`, `P12_PASSWORD`, `KEYCHAIN_PASSWORD`, `BUILD_PROVISION_PROFILE_BASE64`, `PROVISIONING_PROFILE_NAME`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`, `APPLE_API_KEY_BASE64`.
