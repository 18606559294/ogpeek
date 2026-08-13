/*
 * ogpeek — app controller
 * Wires input (paste HTML / fetch URL) -> parse -> render all platform previews.
 */
import { parseHtml, resolveUrl, domainOf } from './parse.js';
import {
  renderTwitter, renderFacebook, renderLinkedIn, renderSlack,
  renderDiscord, renderIMessage, esc,
} from './preview.js';

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

  // platform previews
  $('#prev-twitter').innerHTML = renderTwitter(data, effBase);
  $('#prev-facebook').innerHTML = renderFacebook(data, effBase);
  $('#prev-linkedin').innerHTML = renderLinkedIn(data, effBase);
  $('#prev-slack').innerHTML = renderSlack(data, effBase);
  $('#prev-discord').innerHTML = renderDiscord(data, effBase);
  $('#prev-imessage').innerHTML = renderIMessage(data, effBase);

  // resolved fields table
  renderFields(data, effBase);

  // raw meta inspector
  renderRaw(data.raw);

  // warnings
  renderWarnings(data.warnings);

  // status line
  const count = data.raw.length;
  $('#meta-count').textContent = count + ' meta tag' + (count === 1 ? '' : 's');
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
