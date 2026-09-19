# Release audit — 2026-09-19

## Scope and baseline

Audited upstream `master` at `e78614233af710729f01eab1b46fd3e296b676de` (v1.1.0 package), source/build/UI/progress code, tests, documentation, website configuration, all 22 issues and 14 pull requests returned by the paginated GitHub API, their issue comments, the open PR’s review comments, all 5 Discussions, release metadata, Actions history, repository rules, and open security alerts. The downloaded workspace matched upstream exactly before edits. Work is on `codex/release-hardening`.

Baseline: **104 passing tests**, no known npm vulnerabilities. The package was 1.1.0 but engine diagnostics still reported 0.12.1 and README history called 0.12.1 current. PR #38 contained five additional tests and a valid review finding about unbounded SSE body reads. The implementation from commits `d816a48` and `9b1bc08` is incorporated and credited to @zvictor. At the maintainer’s request all release-branch commits use Rashid Azarang <rashid.azarang.eg@gmail.com> as their sole Git author and committer. The original PR was not merged, closed, or modified.

This is a source-backed release audit, not a guarantee that no undiscovered bugs remain. Live provider interfaces and private endpoints can change independently of this repository.

## Findings and disposition

| Priority | Finding | Disposition / evidence |
|---|---|---|
| P1 | Response deadlines ended at headers; JSON/image/SSE bodies could hang indefinitely. | Fixed in `fetchWithTimeout`: body consumption and explicit timeout race; regression tests for headers and each body kind. |
| P1 | A five-second primary conversation request unnecessarily fell back to incomplete DOM exports (#41). | 60s conversation request / 120s retrieval budget; independent optional enrichment budget, backward-compatible overrides. |
| P1 | UI removal deleted images inside buttons; temporary chats could not recover them (#40). | Preserve media before button removal; all three formats covered, plus a real browser smoke on synthetic HTML. Original reporter DOM has not been inspected. |
| P1 | DOM capture dropped short non-empty turns. | Removed length thresholds; OK and emoji replies tested across formats. |
| P1 | App-backed Deep Research absent from exports; PR #38 could hang and claim completeness despite a missing report. | Incorporated and hardened PR; bounded streams, report/summary preservation, recovered metadata, and persistent incomplete notices. |
| P2 | Streamed images were size-checked only after buffering. | Count/cancel oversized streams while reading; unsupported signed-link schemes rejected; network failures yield placeholders. |
| P2 | Authenticated redirect hops and CDN referrers lacked explicit restrictions. | Authenticated requests use redirect:error; CDN requests omit credentials/referrers; regression tests verify boundaries. |
| P2 | Incomplete status existed only in ephemeral UI. | Warning persists in saved Markdown/HTML and printed PDF-ready content. |
| P2 | Diagnostics/version history drifted from the shipped package. | v1.2.0 source/package/lock/header consistency checked during build and tests. |
| P2 | CI still targeted EOL Node 20, used mutable action tags, and did not package releases. | Node 22.22.2/24/26 matrix; commit-pinned actions; advisory check; release artifact with SHA256SUMS. |
| P2 | Active repository rules require review, but do not require CI or resolved review threads. | Read-only finding. Before release, require the three successful test jobs and review-thread resolution; keep maintainer bypass deliberate. No rule settings were changed. |
| P2 | Public docs claimed no network requests; mutable CSS/JS had a one-year immutable cache. | Corrected network/privacy descriptions and changed mutable asset caching to revalidation. |
| P3 | Missing bookmarklet distribution (#39), security policy, and actionable bug-report context. | Added generated bookmarklets, SECURITY.md, contribution/release guide, and expanded issue template. |
| P3 | Two public tutorial images pointed at nonexistent local files. | Removed broken image references and updated installation copy; local link scan now resolves every local target. |

## Issue inventory

| Issue | State at audit | Disposition |
|---|---|---|
| [#6 — output contains duplicate chat turns ](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/6) | closed | Nested-element and duplicate-identity protection retained; separately identified repeated turns are now preserved. Anonymous virtualizer positions remain heuristic. |
| [#7 — Script not working with Deep Research responses. ](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/7) | closed | Closed but a later comment still reported missing Deep Research. PR #38 is included and hardened here; live app-backed report validation remains required. |
| [#8 — Export button is not visible ](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/8) | closed | Superseded by current native-menu integration and floating fallback; old comments describe retired UI. |
| [#12 — Improve the export file names ](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/12) | closed | Existing conversation-title filenames and title regressions retained. |
| [#13 — Actual conversation URLs are not matched by the rules. ](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/13) | closed | Existing chatgpt.com/* match covers /c/ and /g/ routes. |
| [#14 — Userscript URL match ](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/14) | closed | Existing generated userscripts and current-domain matches retained. |
| [#16 — Exporting reference links ](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/16) | closed | Existing reference-link/citation tests retained. |
| [#17 — chrome extension ](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/17) | closed | Closed but not implemented as a browser extension. Keep as explicit roadmap work; userscripts and bookmarklets satisfy convenience without claiming extension delivery. |
| [#18 — Mathjax support ](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/18) | closed | Existing MathJax/KaTeX and Gemini data-math coverage retained. |
| [#19 — FR: Properly handle tables ](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/19) | closed | Existing Markdown/HTML table coverage retained; complex spans remain flattened. |
| [#22 — Security Improvements ](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/22) | closed | Existing URL opt-in and fence protections retained; added authenticated redirect/body limits, output CSP, security policy, pinned CI and checksums. Raw Markdown remains untrusted viewer input. |
| [#25 — Markdown format export mismatch ](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/25) | closed | Existing prompt/code whitespace and backslash regressions retained. |
| [#27 — Export of references ](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/27) | closed | Existing per-message references preserved and covered by regression tests. |
| [#28 — You do not mention how you deal with lazy loading. ](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/28) | closed | Existing virtualized sweep and payload-first Markdown route retained; documentation updated. |
| [#29 — Long conversation with ChatGPT is not exporting fully ](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/29) | closed | Existing virtualized sweep/order/recovery tests retained; #41 fixes the newly reported primary-fetch timeout. |
| [#31 — No export button with v0.8.0 ](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/31) | closed | Existing floating-launcher/Trusted Types and enterprise-shaped tests retained. |
| [#32 — Additional information in Chat Transcripts ](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/32) | closed | Existing timestamp/file/reasoning enrichment retained; recovered research messages now keep citations and timestamps. |
| [#33 — Images are missing ](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/33) | closed | Existing payload/DOM image coverage retained; #40 hardens preview-button cleanup. |
| [#34 — Greasy Fork userscript is outdated/broken compared with GitHub version ](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/34) | closed | Already addressed in v1.1.0. Verify both GreasyFork channels after release; no external listing was modified during this audit. |
| [#39 — Feature Request: Make browser console version into bookmarklet ](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/39) | open | Implemented: four generated self-contained bookmarklets and installer. CSP/URL-size limitations are documented; cross-browser bookmark installation remains a release check. |
| [#40 — Images are not included in temporary chat ](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/40) | open | Implemented for the reproduced clickable-preview DOM shape. Image-only/short-turn tests pass; original temporary-chat reproduction remains a live check. |
| [#41 — Long conversations can exceed the 5s conversation-fetch timeout and unnecessarily fall back to incomplete DOM export ](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/41) | open | Implemented: separate primary-read timeout/budget; full-body deadlines. Reproduce the original 1,243-message case before release. |

## Pull request inventory

| PR | GitHub state | Disposition |
|---|---|---|
| [#9 — Update README.md](https://github.com/rashidazarang/chatgpt-chat-exporter/pull/9) | closed | Closed README proposal; current installation docs supersede it. |
| [#10 — Update README.md](https://github.com/rashidazarang/chatgpt-chat-exporter/pull/10) | merged | Historical merged work; covered by the baseline/source review. |
| [#11 — refactor: optimize Gemini conversation exporter with modular architecture and enhanced error handling](https://github.com/rashidazarang/chatgpt-chat-exporter/pull/11) | merged | Historical merged work; covered by the baseline/source review. |
| [#15 — Update README.md](https://github.com/rashidazarang/chatgpt-chat-exporter/pull/15) | merged | Historical merged work; covered by the baseline/source review. |
| [#20 — fix: preserve code blocks in modern ChatGPT exports](https://github.com/rashidazarang/chatgpt-chat-exporter/pull/20) | merged | Historical merged work; covered by the baseline/source review. |
| [#21 — Rewrite live chat extraction engine](https://github.com/rashidazarang/chatgpt-chat-exporter/pull/21) | merged | Historical merged work; covered by the baseline/source review. |
| [#23 — Bump undici from 7.25.0 to 7.28.0](https://github.com/rashidazarang/chatgpt-chat-exporter/pull/23) | closed | Closed; newer dependency/source fixes and regression coverage supersede the proposal. |
| [#24 — Fix newlines in code blocks](https://github.com/rashidazarang/chatgpt-chat-exporter/pull/24) | closed | Closed; newer dependency/source fixes and regression coverage supersede the proposal. |
| [#26 — Integrate exports into ChatGPT's native menus](https://github.com/rashidazarang/chatgpt-chat-exporter/pull/26) | merged | Historical merged work; covered by the baseline/source review. |
| [#30 — Bump undici from 7.28.0 to 7.29.0](https://github.com/rashidazarang/chatgpt-chat-exporter/pull/30) | merged | Historical merged work; covered by the baseline/source review. |
| [#35 — Fix whitespace loss from non-citation references](https://github.com/rashidazarang/chatgpt-chat-exporter/pull/35) | closed | Closed rather than merged; maintainer comments and master source confirm the change was landed for v1.1.0. |
| [#36 — Use the ChatGPT tab title for exports](https://github.com/rashidazarang/chatgpt-chat-exporter/pull/36) | closed | Closed rather than merged; maintainer comments and master source confirm the change was landed for v1.1.0. |
| [#37 — Fold reasoning progress into its final answer](https://github.com/rashidazarang/chatgpt-chat-exporter/pull/37) | closed | Closed rather than merged; maintainer comments and master source confirm the change was landed for v1.1.0. |
| [#38 — Export app-backed Deep Research reports](https://github.com/rashidazarang/chatgpt-chat-exporter/pull/38) | open | Contribution incorporated and credited to @zvictor, then hardened. Original PR remains open; do not merge the same changes twice. |

## Discussions and releases

- [Discussion #1 — Welcome to chatgpt-chat-exporter Discussions!](https://github.com/rashidazarang/chatgpt-chat-exporter/discussions/1): Welcome thread; no comments or open request.
- [Discussion #2 — ChatGPT Chat Exporter v1.0.0](https://github.com/rashidazarang/chatgpt-chat-exporter/discussions/2): Legacy announcement with an empty release-tag link; keep as historical context, not current instructions.
- [Discussion #3 — ChatGPT Chat Exporter v1.0.0](https://github.com/rashidazarang/chatgpt-chat-exporter/discussions/3): Legacy v1.0.0 announcement; current README supersedes its UI details.
- [Discussion #4 — ChatGPT Chat Exporter v1.1.0](https://github.com/rashidazarang/chatgpt-chat-exporter/discussions/4): Historical announcement now shares the v1.1.0 label with the newer release. Its sidebar instructions are stale; clarify when announcing the next release.
- [Discussion #5 — user script domain match for chatgpt.com](https://github.com/rashidazarang/chatgpt-chat-exporter/discussions/5): Domain-match request is already covered by chatgpt.com/*.

There were 28 release records. Latest published release: v1.1.0, 2026-08-22. It has no attached assets. This branch prepares artifacts but creates no tag or published release. Open CodeQL, Dependabot and secret-scanning API results were empty at audit time; that does not prove absence of vulnerabilities. Prior master CI/CodeQL runs succeeded. PR #38 CI needed maintainer action, and its Vercel preview required authorization.

## Validation

- Baseline: 104 tests passed. Release candidate: **153 tests passed locally on Node 22.22.3**, including regression, bookmarklet, and release-package verification. The first PR CI run passed on Node 22.22.2, 24, and 26; its later aggregate CodeQL check identified an HTML-regex assertion in a test. The second pass replaces it with a parsed-DOM assertion against mixed-case script/event-handler injection. Current-head CI outcomes are recorded in the PR. `npm run release:prepare` produces 21 files plus SHA256SUMS, including the compatibility guide; the package regression verifies every checksum and rejects stale staging files. Final npm audit: zero known vulnerabilities.
- Regression cases: slow/stalled request headers and bodies, primary timeout configuration, button-wrapped images, short replies, image-stream cancellation, credential/referrer boundaries, unsafe download schemes, missing and recovered research reports, and report-followed-by-summary preservation, repeated-turn identity, malformed active-branch graphs, streaming status, shared DOM/download budgets, canvas pixel limits, forged media attributes, and MIME mismatches.
- Each of the four minified bookmarklets executes the embedded program in jsdom, produces the expected download, retains conversation text, and returns a non-string completion value.
- Real Chromium-based in-app browser: synthetic five-turn conversation exported as HTML; both repeated OK turns, emoji, and the image appeared in the rendered export, while a 100-million-pixel canvas became a labelled placeholder. This was not a signed-in ChatGPT/Gemini compatibility check.
- Browser CI: 66 checks across Chromium, Firefox, and WebKit cover shipped console bundles, full bookmarklet URLs, both userscripts under strict CSP, real downloads, rendered media, rich ChatGPT/Gemini extraction, 1,243 ordered payload turns, and app-backed research. Current-head results are recorded in the PR. See [COMPATIBILITY.md](COMPATIBILITY.md) for scope and limitations.
- Local website target scan: two missing image URLs removed; all remaining local links/assets resolve. Generated artifacts are verified byte-for-byte by npm test.

## Remaining release gates

- [ ] Review and merge the release PR after all CI jobs pass. Decide required status checks in the active master ruleset; no remote policy was changed during this work.
- [ ] Reproduce #41 on a stored conversation with approximately 1,243 messages and verify beginning, middle, end, turn order, timestamps, and counts.
- [ ] Reproduce #40 on an actual temporary conversation with uploaded and generated images, including blob-backed previews, in Chrome, Firefox, and Safari. Unavailable bytes must remain a clear placeholder.
- [ ] Verify current app-backed Deep Research in Markdown, HTML and PDF, including an ongoing/unavailable task and a report in the middle of a conversation.
- [ ] Install both userscript entry points and bookmarklets in target browsers; verify userscript-manager installation/update, current enterprise menus, and actual bookmark URL storage limits. CI exercises no-Share fallback, CSP/Trusted Types, and full bookmarklet URL execution.
- [ ] Verify a current Gemini conversation with math, code and a long scroller. Historical live selectors are not sufficient evidence.
- [ ] Publish the reviewed commit’s release artifacts/checksums, then verify GitHub and GreasyFork versions. Production publication remains pending final compatibility validation.

## Follow-up roadmap and known limits

1. **Anonymous virtualizers:** stable message and turn ids are preferred. Without ids, measurable scroller position plus role identifies remounted turns; layout shifts can still cause duplicates or missed turns. Distinct static DOM nodes are retained even when text repeats.
2. **Payload compatibility:** missing, broken, inherited, and cyclic current-node ancestry now falls back to DOM with an incomplete warning instead of mixing branches. New private API schemas may require updates; unknown structures must stay conservative.
3. **Media fidelity:** DOM/canvas and downloaded attachments now share per-export budgets (20 MiB per image, 50 MiB aggregate by default); canvas work is capped at 16,777,216 pixels before allocation/serialization. These caps govern embedded attachments, not arbitrary data URLs already present in native Markdown text. Unavailable or over-budget images remain URLs/placeholders and still count as captured turns. Actual lazy/blob preview coverage remains a live-browser gate.
4. **Research fidelity:** recovery depends on private, evolving metadata/task carriers. Direct-result recognition is heuristic. HTML/PDF payload recovery preserves escaped text, not the iframe’s original rich layout.
5. **Distribution and product scope:** #17’s Chrome extension request was closed after a promise but never implemented. Track extension/store work explicitly, along with optional JSON/TXT/EPUB or bulk-export requests; these are separate product additions, not part of this release.
6. **Maintenance:** the engine is a large shared file. Split modules only with stable serialization/network tests and unchanged generated output. Keep public/ as the canonical website; the older site/ tree remains a duplication risk.

No issue comments, announcements, issue state changes, repository-rule changes, or external distribution updates were made by this audit.
