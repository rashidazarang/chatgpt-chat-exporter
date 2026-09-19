# v1.2.0 — release candidate

Unreleased. This branch prepares the next release; the checklist in [RELEASE_AUDIT.md](../docs/RELEASE_AUDIT.md) tracks the remaining live checks.

## Fixes

- Give the primary ChatGPT conversation read a 60-second request timeout and a 120-second retrieval budget. Optional metadata, reports, and attachments retain separate shorter budgets. Existing explicit metadata timeout overrides remain supported (#41).
- Bound response bodies as well as response headers. Stalled JSON, images, and Deep Research streams return to a usable export instead of hanging.
- Preserve images wrapped in preview buttons, including temporary chats where no stored conversation is available. Preserve short replies and emoji-only text turns (#40).
- Keep completed Deep Research reports from app widget state, compatible metadata carriers, legacy async results, direct research results, and task streams. Preserve a report followed by an assistant summary and retain recovered sources/timestamps. Based on @zvictor’s contribution in PR #38; the contribution remains acknowledged here and in the audit.
- Mark unavailable research reports as incomplete, with a persistent notice in the exported Markdown/HTML/PDF-ready file as well as the progress display.

- Preserve repeated turns using message identity instead of matching text; keep duplicate DOM representations collapsed.
- Validate the selected payload branch and mark broken/cyclic ancestry or unfinished responses incomplete.
- Share image byte limits across DOM and payload extraction; reject oversized canvases before allocating, forged media annotations, and mismatched non-raster MIME types.

## Installation and hardening

- Generate self-contained bookmarklets for ChatGPT Markdown, HTML, PDF-ready export, and Gemini Markdown (#39). No remote executable loader; bookmarks must be replaced manually to update. Browser URL limits and site CSP can prevent execution.
- Refuse redirects on authenticated requests; omit credentials and referrers on signed CDN image downloads. Enforce streamed-image size caps while reading. Add restrictive HTML export CSP and a no-referrer policy.
- Update development dependencies to jsdom 30.1.0 and Terser 5.51.2. Development now requires Node 22.22.2+, 24.15.0+, or 26+; browser users need no Node installation.
- Pin CI actions, test supported Node versions, verify generated artifacts and advisories, and prepare downloadable artifacts with SHA256SUMS while removing stale staging files. Add a security reporting policy and dependency-update configuration.
- Keep engine diagnostics, package version, and userscript headers consistent. Correct stale installation/privacy documentation, two broken image links, and caching for mutable website assets.

## Compatibility notes

HTML/PDF remain DOM-first. Recovered payload-only research text is escaped and readable, but does not recreate the report iframe’s visual layout. Temporary/shared conversations still depend on the rendered page. Images that cannot be embedded remain a URL or labelled placeholder. A Chromium-based local smoke test and synthetic regressions do not replace final signed-in ChatGPT/Gemini checks across Chrome, Firefox, and Safari.
