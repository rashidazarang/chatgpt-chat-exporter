# Release audit — 2026-09-19, follow-up 2026-09-25

## Follow-up — 2026-09-25

A live check of the release candidate found that ChatGPT had begun serving a second transcript layout, on which the candidate exported nothing, and that Gemini answers were being flattened. Issue #43 (filed after the candidate) was traced on both layouts. All fixes below have regression tests; the live evidence is in [COMPATIBILITY.md](COMPATIBILITY.md#live-checks-2026-09-25-desktop-chrome).

| Priority | Finding | Disposition / evidence |
|---|---|---|
| P0 | ChatGPT's second transcript layout (`ol[data-conversation-transcript] > li[data-message-role]`, atomic class names) matched no message selector: **0 messages** exported, and the userscript never showed its launcher. | Selector, role (`data-message-role`) and id (the `li`'s own `id`) support; `[data-message-attribution]`, action rows, copy controls and popovers stripped by data attribute; per-turn Share left native. Fixture from the live page; unit and browser tests in every format. |
| P0 | The new layout puts every prompt inside `<button data-user-message-bubble>`, and UI cleanup removed every button — the root cause of #43 there, alongside the length thresholds the candidate had already removed. | Buttons that wrap message content (paragraphs, lists, tables, the prompt bubble) are unwrapped; media-only buttons keep their media; other buttons are removed as before. |
| P1 | New-layout web sources are `<button data-assistant-sources-payload>` with JSON targets, not links: the References list (#27) silently vanished. | Payload targets feed References in document order, inline sources become links, the trailing "Sources" control is dropped, and non-HTTP(S) targets are rejected. |
| P1 | Gemini styles its entire answer `white-space: pre-wrap`; the verbatim-prompt rule read the whole answer as typed text, flattening headings, lists and bold. | Only the top of a pre-wrap region with no rendered structure is verbatim; inherited pre-wrap in formatted content serializes normally. Verified live. |
| P1 | HTML/PDF could not complete a long conversation (#41): after the sweep, the stored conversation was read within the sweep's leftover time and a 15-second metadata budget, and skipped entirely once the sweep ran out of time. | The post-sweep read gets the primary conversation budget (60 s per request, 120 s overall) and runs even after a timed-out sweep; a payload that accounts for every turn proves the export complete. |
| P2 | Recovery was gated on ids the sweep *encountered*, so a turn that was on screen but never readable was neither exported nor recovered; with no DOM ids, positional matches could be recovered twice. | Recovery keys on payload entries not represented in the export; recovered ids clear the matching "never finished rendering" count. |
| P2 | Gemini code fences took the `<code data-test-id="code-content">` element as their header, so the fence language became the first line of code (`printhello`). | Header candidates exclude the code itself; Gemini's `.code-block-decoration` is recognized. |
| P2 | ChatGPT's display math in the new layout (`span.katex > math[display=block]`) exported inline. | Display markers are checked above and below the TeX-carrying node. |
| P2 | Generated-file links trimmed trailing punctuation with `/[.,;:!?*`]+$/`, which retried from every position of a punctuation run: quadratic time on a long run of `!` (CodeQL js/polynomial-redos, alert #51, raised by the first `master` scan of this code, which dates from v0.9.2). | Trimmed by scanning back from the end; a 60,000-character run takes milliseconds instead of seconds (regression test). |
| P3 | Code extraction collapsed consecutive blank lines (two between Python definitions became one); a code fence after a list gained an extra blank line; temporary-chat tabs ("ChatGPT: …" tagline, "Google Gemini") became export titles. | Code keeps every blank line; one blank line before a fence; those tab titles fall back to the provider default. |
| P3 | PR #38 review items: repeated report JSON parsing, an iframe probe on one title string, duplicated auth escalation, and no test for a missing task stream. | Parsed and rendered reports are memoized per message; the probe also matches `src`; JSON and stream reads share one escalation routine; a 404 stream is tested. |
| P3 | Bookmarklets are ~107,000 characters; Firefox rejects bookmark URLs over 65,536 (`DB_URL_LENGTH_MAX`). | Documented on the install page, README and compatibility guide. |

## Export audit — 2026-09-25

A real Markdown export (142 messages: 80 from the user, 62 from ChatGPT; 3 MB), produced before this release from ChatGPT's stored conversation, was audited for artifacts. Citation markers, private-use characters, JSON leaks, HTML entities, code fences, links, duplicate turns and timestamp order were all clean. Four defects were found; each is reproduced by a synthetic regression test in `test/stored-record.test.js` and fixed in v1.2.1.

| Priority | Witnessed | Cause and disposition |
|---|---|---|
| P1 | 18 user requests with no ChatGPT reply, and 6 replies that were only a "Reasoning / progress" caption over an empty answer — all design requests answered with generated images. The file claimed to be complete. | Generated images (and code-execution charts) are `tool` records, which payload-first rendering skipped; the empty assistant reply stored after an image was treated as the answer. Image-bearing tool records are now the answer, hidden copies stay skipped, and empty replies are not answers. |
| P1 | 7 of 48 uploaded images embedded, in order, and the remaining 41 left as `[Image: …]` placeholders. | Every image shared one 15-second budget, fetched sequentially. The budget now grows per image (15 s + 3 s each, capped at 180 s), downloads get 15 s each, and progress counts images. |
| P2 | "The output of this plugin was redacted." and "This code was redacted." shown as reasoning. | Messages addressed to a tool (`recipient` other than `all`) were folded into progress. They are excluded. |
| P2 | (Latent, found while fixing) `file-service://file-…` pointers produced a bogus `[Image: file-service]`, `sediment://` pointers produced no id, and images sharing a name kept only the first. `includeVariants` paired variants by position, so a turn that rendered nothing shifted them. | Ids are read after the pointer scheme; images are keyed by file id; variants are paired by identity. |

## Export audit — v1.2.1, 2026-09-25

A second real Markdown export (93 messages, 18 MB), made with v1.2.1, confirmed that release's fixes live: 6 generated images exported and all 16 images embedded with no placeholders. It was nevertheless marked "may be incomplete", and showed three more defects, fixed in v1.2.2 with tests in `test/stored-record.test.js`.

| Priority | Witnessed | Cause and disposition |
|---|---|---|
| P1 | "This export may be incomplete. A response was unfinished" on a finished conversation. | Any record with an unfinished status anywhere flagged the export; ChatGPT keeps interrupted replies as `in_progress` for good, and the pattern did not even know `finished_partial_completion`. Only the final turn's answer can still be streaming now. |
| P1 | A reply interrupted before any text was saved was dropped: two prompts in a row. A reply stopped inside a ```` ```text ```` block left its fence open, so the rest of the file rendered as code. | Interrupted replies become a stand-in turn or end with a note, in every format, and an open fence is closed where the reply ends. |
| P3 | An 18:11 export on 25 September (UTC−6) was dated 2026-09-26. | Dates used `toISOString()`; they now use the local calendar. |

## Scope and baseline (2026-09-19)

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
| [#40 — Images are not included in temporary chat ](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/40) | open | Implemented for the reproduced clickable-preview DOM shape, and content-wrapping buttons are now unwrapped rather than removed. Image-only/short-turn tests pass; a signed-in temporary chat with uploaded images remains a live check (uploads need an account). |
| [#41 — Long conversations can exceed the 5s conversation-fetch timeout and unnecessarily fall back to incomplete DOM export ](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/41) | open | Implemented: separate primary-read timeout/budget; full-body deadlines. 2026-09-25: HTML/PDF also read the stored conversation with that budget after a sweep, including a timed-out one. A signed-in reproduction of the 1,243-message case is still pending. |
| [#43 — Temporary Chat: Short messages are skipped](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/43) | open (filed 2026-09-22) | Fixed on both layouts: the length thresholds (already removed in the candidate) and, on the new layout, the prompt's own button being stripped. Verified live with a one-word prompt on a chat with no stored copy. |

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
| [#38 — Export app-backed Deep Research reports](https://github.com/rashidazarang/chatgpt-chat-exporter/pull/38) | open | Contribution incorporated and credited to @zvictor, then hardened; its review items are addressed (see the follow-up table). Do not merge the same changes twice. |

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

## Validation — 2026-09-25

- **169 unit tests** pass (153 from the candidate plus 16 for the follow-up findings); 14 of the new tests fail against the candidate's engine, the other two pin behaviour it already had.
- **78 browser checks** pass locally in Chromium, Firefox and WebKit (26 each), including the 2026 transcript in every format and the userscript launcher exporting it under strict CSP.
- Live: see [COMPATIBILITY.md](COMPATIBILITY.md#live-checks-2026-09-25-desktop-chrome).

## Remaining live checks

These need a signed-in ChatGPT account or other browsers, which the 2026-09-25 session did not have.

- [ ] Signed in, confirm which transcript layout ChatGPT serves, and on the 2026 layout that each `li`'s `id` equals the stored message id — timestamps, recovery and completeness checks match on it (tests assume it; a mismatch degrades to positional matching).
- [ ] Reproduce #41 on a stored conversation with approximately 1,243 messages and verify beginning, middle, end, turn order, timestamps, and counts, in Markdown and in HTML/PDF.
- [ ] Reproduce #40 on an actual temporary conversation with uploaded and generated images, including blob-backed previews, in Chrome, Firefox, and Safari. Unavailable bytes must remain a clear placeholder.
- [ ] Re-export the audited conversation while signed in: confirm its generated images, the embedded count of its 48 uploads, and that the two redaction notices are tool-addressed (the fix assumes the `recipient` field ChatGPT uses for tool calls). Check which message id a page turn with a generated image carries before extending image-bearing tool records to HTML/PDF.
- [ ] Verify current app-backed Deep Research in Markdown, HTML and PDF, including an ongoing/unavailable task and a report in the middle of a conversation.
- [ ] Install both userscript entry points and bookmarklets in target browsers; verify userscript-manager installation/update and current enterprise menus. CI exercises no-Share fallback, CSP/Trusted Types, and full bookmarklet URL execution; Firefox cannot store the bookmarklets (65,536-character limit).
- [ ] Verify a long Gemini conversation's scroller. Math, code, tables and lists were verified live on 2026-09-25 in a temporary chat.
- [ ] After publishing, verify the GitHub and GreasyFork versions.
- [ ] Redeploy the website: Vercel's last production deployment is from 2025-09-23 (pushes to `master` only build previews), so the hosted pages predate this release and `/bookmarklets` does not exist there yet. The docs point to the bookmarklet files on GitHub until then.

## Follow-up roadmap and known limits

1. **Anonymous virtualizers:** stable message and turn ids are preferred. Without ids, measurable scroller position plus role identifies remounted turns; layout shifts can still cause duplicates or missed turns. Distinct static DOM nodes are retained even when text repeats.
2. **Payload compatibility:** missing, broken, inherited, and cyclic current-node ancestry now falls back to DOM with an incomplete warning instead of mixing branches. New private API schemas may require updates; unknown structures must stay conservative.
3. **Media fidelity:** DOM/canvas and downloaded attachments now share per-export budgets (20 MiB per image, 50 MiB aggregate by default); canvas work is capped at 16,777,216 pixels before allocation/serialization. These caps govern embedded attachments, not arbitrary data URLs already present in native Markdown text. Unavailable or over-budget images remain URLs/placeholders and still count as captured turns. Actual lazy/blob preview coverage remains a live-browser gate.
4. **Research fidelity:** recovery depends on private, evolving metadata/task carriers. Direct-result recognition is heuristic. HTML/PDF payload recovery preserves escaped text, not the iframe’s original rich layout.
5. **Distribution and product scope:** #17’s Chrome extension request was closed after a promise but never implemented. Track extension/store work explicitly, along with optional JSON/TXT/EPUB or bulk-export requests; these are separate product additions, not part of this release.
6. **Maintenance:** the engine is a large shared file. Split modules only with stable serialization/network tests and unchanged generated output. Keep public/ as the canonical website; the older site/ tree remains a duplication risk.

No issue comments, announcements, issue state changes, repository-rule changes, or external distribution updates were made by this audit.
