/*
 * ogpeek — core engine
 * Parses meta/og/twitter/LD+JSON tags from raw HTML and renders
 * social card previews for Facebook / X (Twitter) / LinkedIn / Slack / Discord / iMessage.
 * 100% client-side. No backend. No network egress required.
 */

/** Parse a meta-tag soup string into structured metadata. */
export function parseHtml(html) {
  const out = {
    title: null,
    description: null,
    url: null,
    siteName: null,
    image: null,
    imageAlt: null,
    imageWidth: null,
    imageHeight: null,
    twitterCard: null,
    twitterSite: null,
    twitterCreator: null,
    locale: null,
    type: null,
    twitterImage: null,
    twitterTitle: null,
    twitterDescription: null,
    author: null,
    canonical: null,
    favicon: null,
    themeColor: null,
    raw: [],
    warnings: [],
  };

  if (!html || !html.trim()) {
    out.warnings.push('Empty input.');
    return out;
  }

  // <title>
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) out.title = decodeEntities(titleMatch[1].trim());

  // meta tags via a robust per-tag scan (handles attribute order, quotes/no-quotes)
  const metas = [];
  const metaRe = /<meta\b[^>]*>/gi;
  let m;
  while ((m = metaRe.exec(html)) !== null) {
    const tag = m[0];
    const prop = getAttr(tag, ['property', 'name', 'itemprop']);
    const content = getAttr(tag, 'content');
    if (prop && content !== undefined) {
      metas.push({ prop: prop.toLowerCase(), content });
    }
  }

  const pick = (keys) => {
    for (const k of keys) {
      const hit = metas.find((x) => x.prop === k);
      if (hit && hit.content) return hit.content;
    }
    return null;
  };

  out.description = pick(['description', 'og:description']);
  out.og = {
    title: pick(['og:title']),
    description: pick(['og:description']),
    url: pick(['og:url']),
    siteName: pick(['og:site_name']),
    image: pick(['og:image', 'og:image:url', 'og:image:secure_url']),
    imageAlt: pick(['og:image:alt']),
    imageWidth: pick(['og:image:width']),
    imageHeight: pick(['og:image:height']),
    type: pick(['og:type']),
    locale: pick(['og:locale']),
  };
  out.twitter = {
    card: pick(['twitter:card']),
    site: pick(['twitter:site']),
    creator: pick(['twitter:creator']),
    title: pick(['twitter:title']),
    description: pick(['twitter:description']),
    image: pick(['twitter:image', 'twitter:image:src']),
    imageAlt: pick(['twitter:image:alt']),
  };

  // canonical / favicon / theme / author
  const linkRe = /<link\b[^>]*>/gi;
  let lm;
  while ((lm = linkRe.exec(html)) !== null) {
    const rel = getAttr(lm[0], 'rel');
    const href = getAttr(lm[0], 'href');
    if (rel && href) {
      if (/canonical/i.test(rel) && !out.canonical) out.canonical = href;
      if (/icon|shortcut/i.test(rel) && !out.favicon) out.favicon = href;
    }
  }

  // Resolve the "effective" fields (og takes priority, twitter fallback)
  out.title = out.og.title || out.title || out.twitter.title;
  out.description = out.og.description || out.description || out.twitter.description;
  out.url = out.og.url || out.canonical || null;
  out.siteName = out.og.siteName || null;
  out.image = out.og.image || out.twitter.image || null;
  out.imageAlt = out.og.imageAlt || out.twitter.imageAlt || out.title || out.siteName || 'preview image';
  out.imageWidth = out.og.imageWidth || null;
  out.imageHeight = out.og.imageHeight || null;
  out.twitterCard = out.twitter.card || (out.image ? 'summary_large_image' : 'summary');
  out.twitterSite = out.twitter.site || null;
  out.twitterCreator = out.twitter.creator || null;
  out.type = out.og.type || 'website';
  out.locale = out.og.locale || null;

  // Collect every meta into raw table for the inspector
  out.raw = metas.map((x) => ({ property: x.prop, content: x.content }));

  // Warnings — the genuinely useful diagnostics
  if (!out.title) out.warnings.push('No title found. Add <title> or og:title.');
  if (!out.description) out.warnings.push('No description. Add og:description or meta description.');
  if (!out.image) {
    out.warnings.push('No social image. This page will render as text-only on every platform.');
  } else {
    if (!/^https?:\/\//i.test(out.image) && !out.image.startsWith('/')) {
      out.warnings.push('og:image is a relative path. Platforms may fail to fetch it.');
    }
    if (!out.imageWidth || !out.imageHeight) {
      out.warnings.push('og:image has no width/height. Some platforms require dimensions to render.');
    }
  }
  if (!out.og.title && !out.og.image) {
    out.warnings.push('No Open Graph tags detected. Facebook/LinkedIn/Slack will show nothing.');
  }
  if (out.twitter.card && out.twitter.card !== 'summary' && !out.twitter.image) {
    out.warnings.push(`twitter:card is "${out.twitter.card}" but no twitter:image set.`);
  }

  return out;
}

function getAttr(tag, names) {
  const list = Array.isArray(names) ? names : [names];
  for (const name of list) {
    // matches: name="..." name='...' name=foo (unquoted, space-terminated)
    const re = new RegExp(
      `\\b${escapeRe(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
      'i'
    );
    const m = tag.match(re);
    if (m) return m[1] ?? m[2] ?? m[3] ?? '';
  }
  return undefined;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 10)));
}

/** Resolve a possibly-relative URL against a base URL. */
export function resolveUrl(u, base) {
  if (!u) return null;
  try {
    return new URL(u, base || undefined).href;
  } catch {
    return u;
  }
}

/** Extract a domain for display ("hostname without www"). */
export function domainOf(u) {
  try {
    return (new URL(u).hostname || '').replace(/^www\./i, '');
  } catch {
    return null;
  }
}
