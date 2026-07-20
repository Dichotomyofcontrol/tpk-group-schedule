// Runs every test file and aggregates results.   Usage:  npm test
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = ['recurrence_test.mjs', 'phase3b_test.mjs', 'phase3f_test.mjs', 'dom_smoke.mjs'];

let failed = 0;
for (const f of files) {
    console.log(`\n──────── ${f} ────────`);
    const r = spawnSync(process.execPath, [path.join(dir, f)], { stdio: 'inherit' });
    if (r.status !== 0) failed++;
}
console.log(`\n======== ${failed ? failed + ' file(s) FAILED' : 'ALL TEST FILES PASSED'} ========`);
process.exit(failed ? 1 : 0);
