# Taverning for iOS

**Approach.** A Capacitor 7 shell (`ios/`) loads the live site (`https://taverning.com/sessions`), so auth, API routes and data stay one codebase. Native plugins run through the Capacitor bridge from `components/native-bridge.tsx`. That file does nothing in a normal browser. Bundling the site isn't possible because the app relies on server routes.

**What makes it native (Guideline 4.2):**
- Native APNs push: poll is up, game tomorrow, Previously on is ready. Tapping a notification deep-links inside the app.
- Universal links: `taverning.com/join/*`, `/invite/*`, `/polls/*` and others open in the app (`/.well-known/apple-app-site-association`).
- Haptics on taps, a native splash screen, a status bar that follows the theme, and safe areas (`viewport-fit=cover`).
- No pinch or focus zoom, no text selection or callouts outside inputs, no rubber-band overscroll, and an offline screen.
- Still needed before App Store review: a native tab bar (Sessions / Polls / Almanac / Account), native share sheet for invite links, a native date picker and action sheets, Sign in with Apple, and a notification settings screen. TestFlight builds are fine without these.

**Build.** `.github/workflows/ios.yml` runs on GitHub's macOS runners. With no signing secrets it builds an unsigned simulator app as a smoke test. When the secrets are present, a manual run signs the app, archives it and uploads it to TestFlight. It never runs on pushes to main.

**Server work still to do:** a push sender that uses the APNs key (`APNS_KEY_ID`, `APNS_KEY_P8`, `APPLE_TEAM_ID`) and hooks into `api/cron/reminders`, poll creation and Previously on imports. It reads tokens from `users/{uid}/devices`.
