/*
 * ogpeek — preview renderers
 * Each function returns an HTML string approximating how a platform renders a card.
 * These are visual approximations, deliberately faithful to real platform chrome.
 */
import { resolveUrl, domainOf } from './parse.js';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const imgOrPlaceholder = (src, alt, w, h) => {
  if (!src) {
    return `<div class="img-empty" aria-label="no image">${esc(alt || 'no image')}</div>`;
  }
  const dims = w && h ? ` width="${esc(w)}" height="${esc(h)}"` : '';
  const onerr =
    'onerror="this.classList.add(\'broken\');this.nextElementSibling.style.display=\'flex\'"';
  return (
    `<img src="${esc(src)}" alt="${esc(alt || '')}" loading="lazy" ${dims} ${onerr}/>` +
    `<div class="img-broken">image failed to load</div>`
  );
};

const empty = '<span class="field-empty">—</span>';

/* X / Twitter — summary_large_image */
export function renderTwitter(data, base) {
  const card = data.twitterCard || 'summary';
  const img = resolveUrl(data.image, base);
  const host = domainOf(data.url) || domainOf(base) || 'domain.com';
  const title = data.title || 'Untitled page';
  const desc = data.description || '';

  if (card === 'summary' || (card !== 'summary_large_image' && card !== 'player' && card !== 'app')) {
    // small square thumbnail card
    return `<div class="tw card small">
      <div class="thumb">${img ? `<img src="${esc(img)}" alt="${esc(data.imageAlt||'')}"/>` : '<div class="img-empty">no image</div>'}</div>
      <div class="body">
        <div class="host">${esc(host)}</div>
        <div class="title">${esc(title)}</div>
        <div class="desc">${esc(truncate(desc, 95))}</div>
      </div>
    </div>`;
  }
  return `<div class="tw card large">
    <div class="hero">${imgOrPlaceholder(img, data.imageAlt, data.imageWidth, data.imageHeight)}</div>
    <div class="body">
      <div class="host">${esc(host)}</div>
      <div class="title">${esc(title)}</div>
      <div class="desc">${esc(truncate(desc, 138))}</div>
    </div>
  </div>`;
}

/* Facebook / generic Open Graph */
export function renderFacebook(data, base) {
  const img = resolveUrl(data.image, base);
  const host = domainOf(data.url) || domainOf(base) || 'domain.com';
  const title = data.title || 'Untitled page';
  const desc = data.description || '';
  return `<div class="fb card">
    <div class="hero">${imgOrPlaceholder(img, data.imageAlt, data.imageWidth, data.imageHeight)}</div>
    <div class="meta">
      <div class="host">${esc(host.toUpperCase())}</div>
      <div class="title">${esc(title)}</div>
      <div class="desc">${esc(truncate(desc, 130))}</div>
    </div>
  </div>`;
}

/* LinkedIn — very close to Facebook but different chrome ratio */
export function renderLinkedIn(data, base) {
  const img = resolveUrl(data.image, base);
  const host = domainOf(data.url) || domainOf(base) || 'domain.com';
  const title = data.title || 'Untitled page';
  const desc = data.description || '';
  return `<div class="li card">
    <div class="hero">${imgOrPlaceholder(img, data.imageAlt, data.imageWidth, data.imageHeight)}</div>
    <div class="meta">
      <div class="title">${esc(title)}</div>
      <div class="host">${esc(host)}</div>
    </div>
  </div>`;
}

/* Slack unfurl */
export function renderSlack(data, base) {
  const img = resolveUrl(data.image, base);
  const host = domainOf(data.url) || domainOf(base) || 'domain.com';
  const title = data.title || 'Untitled page';
  const desc = data.description || '';
  return `<div class="sl card">
    <div class="border"></div>
    <div class="content">
      ${img ? `<div class="thumb">${imgOrPlaceholder(img, data.imageAlt)}</div>` : ''}
      <div class="text">
        <div class="host">${esc(host)}</div>
        <div class="title">${esc(title)}</div>
        ${desc ? `<div class="desc">${esc(truncate(desc, 180))}</div>` : ''}
      </div>
    </div>
  </div>`;
}

/* Discord embed — dark theme */
export function renderDiscord(data, base) {
  const img = resolveUrl(data.image, base);
  const host = domainOf(data.url) || domainOf(base) || 'domain.com';
  const title = data.title || 'Untitled page';
  const desc = data.description || '';
  return `<div class="dc card">
    <div class="bar"></div>
    <div class="inner">
      <div class="provider">${esc(data.siteName || host)}</div>
      <div class="title">${esc(title)}</div>
      ${desc ? `<div class="desc">${esc(truncate(desc, 350))}</div>` : ''}
      ${img ? `<div class="img">${imgOrPlaceholder(img, data.imageAlt, data.imageWidth, data.imageHeight)}</div>` : ''}
    </div>
  </div>`;
}

/* iMessage rich preview (iOS) */
export function renderIMessage(data, base) {
  const img = resolveUrl(data.image, base);
  const host = domainOf(data.url) || domainOf(base) || 'domain.com';
  const title = data.title || 'Untitled page';
  const desc = data.description || '';
  return `<div class="im card">
    <div class="hero">${img ? imgOrPlaceholder(img, data.imageAlt) : '<div class="img-empty">no image</div>'}</div>
    <div class="meta">
      <div class="title">${esc(title)}</div>
      <div class="host">${esc(host)} ›</div>
    </div>
  </div>`;
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

export { esc, empty };
