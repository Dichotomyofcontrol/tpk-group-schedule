# Tests

Automated tests for `index.html` (the whole app ships as that one file).

- **`recurrence_test.mjs`** — the recurring-session date engine (weekly/monthly, ordinal weekdays, month clamping).
- **`phase3b_test.mjs`** — campaign-centric access rules (owner / code / invite / share).
- **`phase3f_test.mjs`** — archive / delete / transfer lifecycle access.
- **`dom_smoke.mjs`** — loads the **real** `../index.html` in jsdom with Firebase stubbed and drives the UI end-to-end: access model, profile/account, campaign page, scheduling + recurrence, availability polls, the recap XSS sanitizer, accessibility, leaving campaigns, and more (190+ assertions).

## Run

```sh
npm install    # once — pulls jsdom
npm test       # runs all of the above
```

## Notes

- `dom_smoke.mjs` reads `../index.html`, so keep these files in this folder.
- It stubs Firebase and runs the app's actual `<script type="module">` in a jsdom window, so it exercises the shipped code (not a copy).
- The three `*_test.mjs` logic files replicate small pure functions for fast checks; they can drift from the app over time, so `dom_smoke.mjs` is the source of truth for real behavior.
- No network, no real Firebase — safe to run anywhere.
