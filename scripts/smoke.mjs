import { parseHtml } from '../js/parse.js';
import { renderTwitter, renderFacebook, renderDiscord } from '../js/preview.js';

const healthy = '<head><meta property="og:title" content="Hi"><meta property="og:image" content="https://x.com/a.png"><meta property="og:image:width" content="1200"><meta name="twitter:card" content="summary_large_image"></head>';
const r = parseHtml(healthy);
console.log('HEALTHY  -> title:', r.title, '| img:', r.image, '| warnings:', r.warnings.length);

const broken = '<head><meta property="og:title" content="Hi"><meta property="og:image" content="/rel.png"></head>';
const rb = parseHtml(broken);
console.log('BROKEN   -> warnings:', rb.warnings.length, '| sample:', JSON.stringify(rb.warnings[0]));

console.log('renderTwitter ok :', renderTwitter(r).length > 0);
console.log('renderFacebook ok:', renderFacebook(r).length > 0);
console.log('renderDiscord ok :', renderDiscord(r).length > 0);
console.log('SMOKE PASS');
