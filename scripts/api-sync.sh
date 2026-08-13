#!/usr/bin/env bash
# Sync cycle-18 ogpeek files to GitHub via Contents API (git push blocked on github.com:443).
set -euo pipefail
cd "$(dirname "$0")/.."   # ogpeek repo root
REPO="18606559294/ogpeek"

push_file() {
  local path="$1" msg="$2"
  local sha
  sha=$(gh api "repos/$REPO/contents/$path" --jq '.sha' 2>/dev/null || echo "")
  local b64
  # base64, no newlines, stdin = file bytes
  b64=$(base64 -w0 "$path")
  local payload
  if [ -n "$sha" ]; then
    payload=$(jq -nc --arg m "$msg" --arg c "$b64" --arg s "$sha" '{message:$m,content:$c,sha:$s}')
  else
    payload=$(jq -nc --arg m "$msg" --arg c "$b64" '{message:$m,content:$c}')
  fi
  echo ">> $path (${#sha} sha) -> pushing..."
  gh api -X PUT "repos/$REPO/contents/$path" --input - <<<"$payload" --jq '.commit.sha + "  " + .content.path' || {
    echo "!! failed: $path"; exit 1;
  }
}

push_file "index.html"                  "fix og:image refs + JSON-LD structured data (cycle 18)"
push_file "og.png"                      "add self-hosted og:image 1200x630 (cycle 18)"
push_file "robots.txt"                  "add robots.txt (cycle 18)"
push_file "sitemap.xml"                 "add sitemap.xml (cycle 18)"
push_file "scripts/gen-og-image.py"     "add og:image regenerator script (cycle 18)"
push_file "scripts/smoke.mjs"           "add parser/renderer smoke test (cycle 18)"
echo "ALL SYNCED"
