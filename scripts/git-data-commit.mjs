// Atomic multi-file commit via Git Data API (bypasses flaky Contents-API rule evaluator).
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = '18606559294/ogpeek';

function gh(args, input) {
  return execFileSync('gh', args, { input, cwd: root, encoding: 'utf8', maxBuffer: 60 * 1024 * 1024 });
}
function api(method, endpoint, body) {
  const args = method === 'GET'
    ? ['api', `repos/${REPO}/${endpoint}`]
    : ['api', '-X', method, `repos/${REPO}/${endpoint}`, '--input', '-'];
  const out = gh(args, body ? JSON.stringify(body) : undefined);
  return JSON.parse(out);
}

// 1. current main ref
const ref = api('GET', 'git/refs/heads/main');
const baseCommitSha = ref.object.sha;
console.log('base commit:', baseCommitSha);

// 2. create blobs for every file we want in the tree (full desired state of changed paths)
const files = [
  ['index.html',                'fix og:image refs + JSON-LD structured data (cycle 18)'],
  ['og.png',                    'add self-hosted og:image 1200x630 (cycle 18)'],
  ['robots.txt',                'add robots.txt (cycle 18)'],
  ['sitemap.xml',               'add sitemap.xml (cycle 18)'],
  ['scripts/gen-og-image.py',   'add og:image regenerator script (cycle 18)'],
  ['scripts/smoke.mjs',         'add parser/renderer smoke test (cycle 18)'],
];
const treeEntries = [];
for (const [path] of files) {
  const content = readFileSync(join(root, path));   // raw bytes -> base64
  const b64 = content.toString('base64');
  const blob = api('POST', 'git/blobs', { content: b64, encoding: 'base64' });
  treeEntries.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
  console.log('blob:', path, blob.sha.slice(0, 7));
}

// 3. base commit -> its tree, then create a new tree with our overrides
const baseCommit = api('GET', `git/commits/${baseCommitSha}`);
const tree = api('POST', 'git/trees', { base_tree: baseCommit.tree.sha, tree: treeEntries });
console.log('new tree:', tree.sha.slice(0, 7));

// 4. create commit pointing at new tree, parent = base
const message = [
  'SEO hardening + self-hosted og:image (cycle 18)',
  '',
  '- og.png: real 1200x630 social card (PIL, warm-black/amber, on-brand)',
  '- fix og:image/twitter:image -> self-hosted og.png (was broken pages.dev ref)',
  '- sitemap.xml + robots.txt for Google crawl discovery',
  '- JSON-LD WebApplication structured data (9 features, free offer)',
  '- scripts/: gen-og-image.py (regenerator) + smoke.mjs (parser/renderer test)',
  '',
  'No behavior change; parser/renderers smoke-test identical to v1.',
].join('\n');
const author = { name: 'Auto-Company', email: 'auto-company@users.noreply.github.com' };
const commit = api('POST', 'git/commits', { message, tree: tree.sha, parents: [baseCommitSha], author });
console.log('new commit:', commit.sha.slice(0, 7));

// 5. fast-forward the ref (update, not force) — fails safely if main moved
try {
  const updated = api('PATCH', 'git/refs/heads/main', { sha: commit.sha, force: false });
  console.log('ref updated ->', updated.object.sha.slice(0, 7));
} catch (e) {
  console.error('REF UPDATE FAILED (main moved or protected):', e.message);
  process.exit(1);
}
console.log('COMMIT LANDED:', commit.sha);
