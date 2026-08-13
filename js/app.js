/*
 * ogpeek — app controller
 * Wires input (paste HTML / fetch URL) -> parse -> render all platform previews.
 * Plus a two-way "generate tags" panel: edit resolved fields -> get a paste-ready <meta> block.
 */
import { parseHtml, resolveUrl } from './parse.js';
import {
  renderTwitter, renderFacebook, renderLinkedIn, renderSlack,
  renderDiscord, renderIMessage, esc,
} from './preview.js';

// ---- exported for tests (pure) ----
export function buildMetaBlock(v) {
  const tags = buildMetaTagList(v);
  if (!tags.length) return '';
  const indent = '  ';
  return tags.map(([k, val]) => `${indent}<meta ${attrName(k)}="${escAttr(k)}" content="${escAttr(val)}" />`).join('\n');
}
export function attrName(k) { return k.startsWith('twitter:') ? 'name' : 'property'; }
function escAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---- generator field config ----
const GEN_FIELDS = [
  { key: 'title', label: 'og:title', placeholder: 'Your page title', tw: true },
  { key: 'description', label: 'og:description', placeholder: 'A short summary', tw: true },
  { key: 'url', label: 'og:url', placeholder: 'https://example.com/page', tw: false },
  { key: 'siteName', label: 'og:site_name', placeholder: 'My Site', tw: false },
  { key: 'image', label: 'og:image', placeholder: 'https://example.com/og.png', tw: 'image' },
  { key: 'imageWidth', label: 'og:image:width', placeholder: '1200', tw: false, num: true },
  { key: 'imageHeight', label: 'og:image:height', placeholder: '630', tw: false, num: true },
  { key: 'imageAlt', label: 'og:image:alt', placeholder: 'Describe the image', tw: 'imageAlt' },
  { key: 'type', label: 'og:type', placeholder: 'website', tw: false },
  { key: 'twitterCard', label: 'twitter:card', placeholder: 'summary_large_image', tw: false, select: ['', 'summary', 'summary_large_image', 'player', 'app'] },
  { key: 'twitterSite', label: 'twitter:site', placeholder: '@handle', tw: false },
  { key: 'twitterCreator', label: 'twitter:creator', placeholder: '@handle', tw: false },
];

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const SAMPLE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ogpeek — preview social cards before you ship</title>
  <meta name="description" content="Paste a URL or HTML and instantly see how your page renders on X, Facebook, LinkedIn, Slack, Discord, and iMessage. Free, no signup.">
  <link rel="canonical" href="https://18606559294.github.io/ogpeek/" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="ogpeek" />
  <meta property="og:title" content="Preview social cards before you ship" />
  <meta property="og:description" content="See exactly how X, Facebook, LinkedIn, Slack, Discord, and iMessage will render your page. Fix broken og:image tags before your users see them." />
  <meta property="og:url" content="https://18606559294.github.io/ogpeek/" />
  <meta property="og:image" content="https://ogpeek.pages.dev/og.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="ogpeek — social card previewer" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@ogpeek" />
  <meta name="twitter:title" content="Preview social cards before you ship" />
  <meta name="twitter:description" content="See how X, Facebook, LinkedIn, Slack, Discord render your page. Free." />
  <meta name="twitter:image" content="https://ogpeek.pages.dev/og.png" />
</head>
</html>`;

let lastBase = null;

export function init() {
  const input = $('#html-input');
  const fetchBtn = $('#fetch-btn');
  const sampleBtn = $('#sample-btn');
  const clearBtn = $('#clear-btn');
  const urlInput = $('#url-input');
  const proxyToggle = $('#proxy-toggle');
  const genCopy = $('#gen-copy');

  // initial render with the sample so the page is never empty
  input.value = SAMPLE;
  run(input.value, 'https://example.com/');

  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => run(input.value, lastBase), 250);
  });

  sampleBtn.addEventListener('click', () => {
    input.value = SAMPLE;
    run(input.value, 'https://example.com/');
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    urlInput.value = '';
    run('', null);
  });

  fetchBtn.addEventListener('click', () => doFetch(urlInput, input, proxyToggle.checked));

  // generator: keep the <meta> block live as fields are edited (two-way)
  $('#gen-form').addEventListener('input', onGenInput);
  $('#gen-form').addEventListener('change', onGenInput);
  genCopy.addEventListener('click', copyGenCode);
}

// current editable generator values (source of truth for previews + output)
let genValues = {};
let genBase = null;

function onGenInput() {
  // read all fields back from the DOM
  GEN_FIELDS.forEach((f) => {
    const el = document.querySelector(`#gen-form [data-k="${f.key}"]`);
    if (!el) return;
    let val = el.value.trim();
    if (f.num) val = val.replace(/[^0-9]/g, '');
    genValues[f.key] = val || null;
  });
  renderGenCode();
  // live-update previews from the edited values (true two-way tool)
  rerenderPreviewsFromGen(genBase);
}

async function doFetch(urlInput, input, useProxy) {
  const url = urlInput.value.trim();
  if (!url) {
    flash('Paste a URL first.', 'err');
    return;
  }
  let normalized = url;
  if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized;

  flash('Fetching…', 'info');
  try {
    const target = useProxy
      ? `https://api.allorigins.win/raw?url=${encodeURIComponent(normalized)}`
      : normalized;
    const res = await fetch(target, { redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    if (!text || text.length < 20) throw new Error('Empty response.');
    input.value = text;
    lastBase = normalized;
    run(text, normalized);
    flash('Fetched ' + text.length + ' bytes. ' +
      (useProxy ? '' : '(Direct fetch worked.)'), 'ok');
  } catch (e) {
    const msg =
      'Direct fetch blocked (CORS / network). ' +
      (useProxy
        ? 'Proxy also failed: ' + esc(e.message) + '. '
        : '') +
      'Paste the page HTML manually (right-click → View Source → Copy).';
    if (!useProxy) {
      // auto-retry with proxy once
      flash('Retrying via public proxy…', 'info');
      return doFetch(urlInput, input, true);
    }
    flash(msg, 'err');
  }
}

function run(html, base) {
  const data = parseHtml(html);
  const effBase = base || (data.url ? resolveUrl(data.url) : lastBase);
  genBase = effBase;

  // seed editable generator values from the freshly parsed data
  genValues = {
    title: data.title,
    description: data.description,
    url: data.url ? resolveUrl(data.url, effBase) : null,
    siteName: data.siteName,
    image: data.image ? resolveUrl(data.image, effBase) : null,
    imageWidth: data.imageWidth,
    imageHeight: data.imageHeight,
    imageAlt: data.imageAlt,
    type: data.type,
    locale: data.locale,
    twitterCard: data.twitterCard,
    twitterSite: data.twitterSite,
    twitterCreator: data.twitterCreator,
    twitterImage: data.image ? resolveUrl(data.image, effBase) : null,
    twitterImageAlt: data.imageAlt,
  };

  // platform previews
  renderAllPreviews(genValues, effBase);

  // resolved fields table
  renderFields(data, effBase);

  // generator form + output
  renderGenForm();
  renderGenCode();

  // raw meta inspector
  renderRaw(data.raw);

  // warnings
  renderWarnings(data.warnings);

  // status line
  const count = data.raw.length;
  $('#meta-count').textContent = count + ' meta tag' + (count === 1 ? '' : 's');
}

function renderAllPreviews(v, base) {
  const d = {
    title: v.title, description: v.description, url: v.url, siteName: v.siteName,
    image: v.image, imageAlt: v.imageAlt, imageWidth: v.imageWidth, imageHeight: v.imageHeight,
    twitterCard: v.twitterCard, twitterSite: v.twitterSite, twitterCreator: v.twitterCreator,
    twitterTitle: v.title, twitterDescription: v.description, twitterImage: v.twitterImage,
  };
  $('#prev-twitter').innerHTML = renderTwitter(d, base);
  $('#prev-facebook').innerHTML = renderFacebook(d, base);
  $('#prev-linkedin').innerHTML = renderLinkedIn(d, base);
  $('#prev-slack').innerHTML = renderSlack(d, base);
  $('#prev-discord').innerHTML = renderDiscord(d, base);
  $('#prev-imessage').innerHTML = renderIMessage(d, base);
}

function rerenderPreviewsFromGen(base) {
  renderAllPreviews(genValues, base);
}

function renderGenForm() {
  const html = GEN_FIELDS.map((f) => {
    const val = genValues[f.key] ?? '';
    const control = f.select
      ? `<select data-k="${f.key}">${f.select.map((o) =>
          `<option value="${esc(o)}"${o === val ? ' selected' : ''}>${esc(o || '— none —')}</option>`).join('')}</select>`
      : `<input data-k="${f.key}" type="text" value="${escAttr(val)}" placeholder="${esc(f.placeholder || '')}" spellcheck="false" autocomplete="off" />`;
    const hint = f.tw === true ? '<span class="hint">also feeds twitter:title / description</span>'
      : f.tw === 'image' ? '<span class="hint">also feeds twitter:image</span>'
      : f.tw === 'imageAlt' ? '<span class="hint">also feeds twitter:image:alt</span>' : '';
    return `<div class="gen-field"><label>${esc(f.label)}${hint}</label>${control}</div>`;
  }).join('');
  $('#gen-form').innerHTML = html;
}

function renderGenCode() {
  const v = { ...genValues };
  v.twitterImage = v.image;
  v.twitterImageAlt = v.imageAlt;
  const tags = buildMetaTagList(v);
  const el = $('#gen-code');
  if (!tags.length) {
    el.innerHTML = '<span class="t-empty">Fill a field above to generate tags.</span>';
    return;
  }
  el.innerHTML = tags.map(([k, val]) => {
    const attr = attrName(k);
    return '<span class="t-tag">&lt;meta</span> <span class="t-attr">' + esc(attr) + '</span>="' + esc(k) + '" <span class="t-attr">content</span>="<span class="t-val">' + esc(val) + '</span>" /&gt;';
  }).join('\n');
}

// ordered list of [key, value] pairs (pure, exported for tests)
export function buildMetaTagList(v) {
  const tags = [];
  if (v.title) tags.push(['og:title', v.title]);
  if (v.description) tags.push(['og:description', v.description]);
  if (v.url) tags.push(['og:url', v.url]);
  if (v.siteName) tags.push(['og:site_name', v.siteName]);
  if (v.image) tags.push(['og:image', v.image]);
  if (v.imageWidth) tags.push(['og:image:width', String(v.imageWidth)]);
  if (v.imageHeight) tags.push(['og:image:height', String(v.imageHeight)]);
  if (v.imageAlt) tags.push(['og:image:alt', v.imageAlt]);
  if (v.type) tags.push(['og:type', v.type]);
  if (v.locale) tags.push(['og:locale', v.locale]);
  if (v.twitterCard) tags.push(['twitter:card', v.twitterCard]);
  if (v.twitterSite) tags.push(['twitter:site', v.twitterSite]);
  if (v.twitterCreator) tags.push(['twitter:creator', v.twitterCreator]);
  if (v.twitterImage) tags.push(['twitter:image', v.twitterImage]);
  if (v.twitterImageAlt) tags.push(['twitter:image:alt', v.twitterImageAlt]);
  return tags;
}

function copyGenCode() {
  const v = { ...genValues, twitterImage: genValues.image, twitterImageAlt: genValues.imageAlt };
  const code = buildMetaBlock(v);
  const flashEl = $('#gen-flash');
  const done = (msg, kind) => {
    flashEl.textContent = msg;
    flashEl.className = 'gen-flash show' + (kind ? ' ' + kind : '');
    setTimeout(() => { flashEl.className = 'gen-flash'; }, 2500);
  };
  if (!code) { done('Nothing to copy yet.', 'err'); return; }
  const full = '<!-- open-graph + twitter card tags -->\n' + code + '\n';
  const ok = () => done('Copied ' + (full.split('\n').length - 2) + ' tags to clipboard ✓');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(full).then(ok, () => fallbackCopy(full, ok, done));
  } else {
    fallbackCopy(full, ok, done);
  }
}

function fallbackCopy(text, ok, err) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const worked = document.execCommand('copy');
    document.body.removeChild(ta);
    if (worked) ok(); else err('Copy failed — select the code manually.', 'err');
  } catch {
    err('Copy failed — select the code manually.', 'err');
  }
}

function renderFields(d, base) {
  const img = resolveUrl(d.image, base);
  const rows = [
    ['Title', d.title],
    ['Description', d.description],
    ['URL', d.url ? resolveUrl(d.url, base) : null],
    ['Site name', d.siteName],
    ['Image', img],
    ['Image alt', d.imageAlt],
    ['Image dimensions', d.imageWidth && d.imageHeight ? `${d.imageWidth} × ${d.imageHeight}` : null],
    ['twitter:card', d.twitterCard],
    ['twitter:site', d.twitterSite],
    ['twitter:creator', d.twitterCreator],
    ['og:type', d.type],
    ['og:locale', d.locale],
    ['Canonical', d.canonical ? resolveUrl(d.canonical, base) : null],
  ];
  const html = rows.map(([k, v]) => {
    const isUrl = v && /^https?:\/\//i.test(v);
    const val = v
      ? isUrl
        ? `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(v)}</a>`
        : esc(v)
      : '<span class="field-empty">missing</span>';
    return `<div class="row"><div class="k">${esc(k)}</div><div class="v">${val}</div></div>`;
  }).join('');
  $('#fields').innerHTML = html;
}

function renderRaw(metas) {
  if (!metas.length) {
    $('#raw').innerHTML = '<div class="raw-empty">No meta tags found.</div>';
    return;
  }
  const rows = metas.map((x) =>
    `<div class="raw-row"><span class="rk">${esc(x.property)}</span><span class="rv">${esc(x.content)}</span></div>`
  ).join('');
  $('#raw').innerHTML = rows;
}

function renderWarnings(w) {
  const el = $('#warnings');
  if (!w.length) {
    el.innerHTML = '<div class="warn-ok">No issues detected. Every essential tag is present.</div>';
    el.classList.remove('has-warn');
    return;
  }
  el.classList.add('has-warn');
  el.innerHTML =
    '<div class="warn-head">Issues that will hurt how this page renders</div>' +
    w.map((x) => `<div class="warn-item"><span class="dot"></span>${esc(x)}</div>`).join('');
}

let flashTimer;
function flash(msg, kind) {
  const el = $('#flash');
  el.textContent = msg;
  el.className = 'flash show ' + kind;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { el.className = 'flash'; }, 5000);
}
