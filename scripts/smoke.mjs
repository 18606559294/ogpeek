import { parseHtml } from '../js/parse.js';
import { renderTwitter, renderFacebook, renderDiscord } from '../js/preview.js';
import { buildMetaBlock, attrName } from '../js/app.js';

const healthy = '<head><meta property="og:title" content="Hi"><meta property="og:image" content="https://x.com/a.png"><meta property="og:image:width" content="1200"><meta name="twitter:card" content="summary_large_image"></head>';
const r = parseHtml(healthy);
console.log('HEALTHY  -> title:', r.title, '| img:', r.image, '| warnings:', r.warnings.length);

const broken = '<head><meta property="og:title" content="Hi"><meta property="og:image" content="/rel.png"></head>';
const rb = parseHtml(broken);
console.log('BROKEN   -> warnings:', rb.warnings.length, '| sample:', JSON.stringify(rb.warnings[0]));

console.log('renderTwitter ok :', renderTwitter(r).length > 0);
console.log('renderFacebook ok:', renderFacebook(r).length > 0);
console.log('renderDiscord ok :', renderDiscord(r).length > 0);

// ---- generator: buildMetaBlock (cycle 19) ----
const block = buildMetaBlock({
  title: 'Hi', description: 'D', url: 'https://x.com/', siteName: 'S',
  image: 'https://x.com/a.png', imageWidth: '1200', imageHeight: '630',
  imageAlt: 'alt', type: 'website', locale: 'en_US',
  twitterCard: 'summary_large_image', twitterSite: '@x', twitterCreator: '@y',
  twitterImage: 'https://x.com/a.png', twitterImageAlt: 'alt',
});
const lines = block.split('\n');
console.log('GEN lines      :', lines.length);
console.log('GEN has og:title:', block.includes('property="og:title"'));
console.log('GEN has tw:card :', block.includes('name="twitter:card"'));
console.log('GEN esc quotes  :', buildMetaBlock({ title: 'a "b" c' }).includes('&quot;'));
console.log('GEN empty -> "" :', buildMetaBlock({}) === '');
console.log('attrName og     :', attrName('og:title'));
console.log('attrName tw     :', attrName('twitter:card'));
if (lines.length !== 15) throw new Error('expected 15 meta lines, got ' + lines.length);
if (!block.includes('property="og:title"')) throw new Error('missing og:title');
if (!block.includes('content="Hi"')) throw new Error('missing content value');
if (!block.includes('name="twitter:card"')) throw new Error('missing twitter:card name attr');
console.log('SMOKE PASS');
