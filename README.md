# ogpeek

> Paste a URL or your HTML. See exactly how X, Facebook, LinkedIn, Slack, Discord, and iMessage will render your page. Catch broken `og:image` / `twitter:card` tags before your users do.

**Live:** https://18606559294.github.io/ogpeek/

Free. No signup. No backend. Your HTML never leaves your browser.

## What it does

ogpeek is a **social card previewer + meta tag inspector**. Given a page's HTML (fetched from a URL or pasted directly), it:

1. **Renders 6 platform previews** — X/Twitter (summary & large-image), Facebook, LinkedIn, Slack, Discord, iMessage — each styled to match how that platform actually displays the card.
2. **Inspects every `<meta>` tag** — Open Graph, Twitter Card, canonical, favicon, theme color — in a raw table.
3. **Diagnoses problems** — missing title/description/image, relative image paths, missing dimensions, card-type/image mismatches.
4. **Generates `<meta>` tags (two-way)** — edit any resolved field in the *Generate tags* panel and ogpeek emits a paste-ready Open Graph + Twitter Card block. Previews update live as you edit, so it's a true inspector *and* generator in one pass.

## Why

A broken `og:image` makes your link render as a text-only block, and studies put the click-through lift from a good preview at **2–5×**. Every platform trims and crops differently. ogpeek shows all of them in one pass, so you ship a card that actually looks right.

## How it works

- **100% client-side.** No backend, no API keys, no tracking, no data leaves the browser.
- **URL fetch** is best-effort: direct first, then an optional public CORS proxy (`allorigins.win`) — and if both are blocked by CORS, you paste the HTML (right-click → View Source → Copy).
- **Parser** (`js/parse.js`) is a per-`<meta>`-tag scanner that handles attribute reordering, quoted/unquoted values, and entity decoding — more robust than a single regex.
- **Renderers** (`js/preview.js`) return HTML strings approximating real platform chrome.

## Companion: SnapOG

ogpeek tells you *what's wrong* with your social cards. [**SnapOG**](https://github.com/18606559294/snapog) generates the `og:image` PNG itself — 3 templates, global edge cache, a free tier, key auth + usage tracking. One URL:

```
GET https://snapog.workers.dev/img?title=Hello&template=sunset
# → 1200×630 PNG, edge-cached worldwide
```

## Run locally

It's static. Just open `index.html`, or:

```bash
npx serve .
# or
python -m http.server 8000
```

## Tech

Vanilla JS (ES modules), hand-written CSS, no build step, no dependencies. Fonts: JetBrains Mono + Instrument Serif. Deploys via GitHub Actions to GitHub Pages on every push to `main`.

## License

MIT. Copy whatever helps.
