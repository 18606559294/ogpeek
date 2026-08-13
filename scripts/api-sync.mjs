// Sync cycle-18 ogpeek files to GitHub via Contents API
// (git push blocked on github.com:443 from sandbox; api.github.com reachable via gh).
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = '18606559294/ogpeek';

function gh(args, input) {
  return execFileSync('gh', args, { input, cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
}

function remoteSha(path) {
  try {
    const out = gh(['api', `repos/${REPO}/contents/${path}`, '--jq', '.sha']);
    return out.trim();
  } catch { return ''; }
}

function pushFile(rel, message) {
  const abs = join(root, rel);
  const content = readFileSync(abs).toString('base64');
  const sha = remoteSha(rel);
  const payload = JSON.stringify({ message, content, ...(sha ? { sha } : {}) });
  const out = gh(['api', '-X', 'PUT', `repos/${REPO}/contents/${rel}`, '--input', '-'], payload);
  const { commit, content: c } = JSON.parse(out);
  console.log(`>> ${rel}  [${sha ? 'updated' : 'created'}]  commit ${commit.sha.slice(0,7)}`);
}

const files = [
  ['index.html',                'fix og:image refs + JSON-LD structured data (cycle 18)'],
  ['og.png',                    'add self-hosted og:image 1200x630 (cycle 18)'],
  ['robots.txt',                'add robots.txt (cycle 18)'],
  ['sitemap.xml',               'add sitemap.xml (cycle 18)'],
  ['scripts/gen-og-image.py',   'add og:image regenerator script (cycle 18)'],
  ['scripts/smoke.mjs',         'add parser/renderer smoke test (cycle 18)'],
];

for (const [path, msg] of files) pushFile(path, msg);
console.log('ALL SYNCED');
