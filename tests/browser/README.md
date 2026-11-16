# Browser smoke test

Run `cd tests/browser && npm install && npm test` (headless Chromium, no Oracle database or APEX sign-in).
Each check prints PASS, FAIL or SKIP; the script exits non-zero if any check fails.

To refresh the static screens in design-handoff/ for a visual designer: `node snapshot.js`.
