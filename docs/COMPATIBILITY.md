# Browser compatibility

The browser matrix runs with pinned Playwright 1.63.0 on Linux CI. It uses synthetic conversations and intercepts every network request, so it needs no provider credentials and publishes no private chat data. Each engine runs 22 checks. Current results are attached to the release PR; the matrix must pass before release.

| Distribution or behavior | Chromium | Firefox | WebKit |
| --- | --- | --- | --- |
| ChatGPT Markdown, HTML, PDF-ready console bundles | CI | CI | CI |
| Gemini Markdown console bundle | CI | CI | CI |
| Four full self-contained bookmarklet URLs | CI | CI | CI |
| Both ChatGPT userscripts: Markdown/PDF menu downloads without Share | CI | CI | CI |
| Rich ChatGPT/Gemini extraction in all engine formats; rendered HTML images/tables | CI | CI | CI |
| 1,243-message payload: every turn, order, timestamp, no DOM sweep | CI | CI | CI |
| App-backed research recovery in Markdown/HTML/PDF-ready output | CI | CI | CI |
| Strict script CSP; UI icons without any parser/HTML sink | CI | CI | CI |
| Enforced Trusted Types assertion | CI | Not asserted | Not asserted |

## Run the checks

```sh
npm ci
npx playwright install --with-deps
npm test
npm run test:browser
# One engine:
npm run test:browser -- --project=firefox
```

CI retains HTML reports and failure traces for 14 days. Retries are disabled so a flaky failure cannot silently become a green check. Unit tests remain separate from browser tests.

## Scope and remaining live checks

- These checks execute real browser engines and verify real downloaded files, but provider pages/API responses are fixtures. A provider can change its private API or rendered markup independently of a browser update.
- Chromium is engine coverage relevant to Chrome/Edge; WebKit is engine coverage relevant to Safari. This is not a certification of every branded release, operating system, mobile browser, or userscript manager.
- The userscript source executes under a strict policy in CI. Installing/updating through Tampermonkey, Violentmonkey, or Greasemonkey remains a separate manager check. PDF export produces an HTML file intended for the browser's Print / Save as PDF action; it is not a native PDF download.
- Bookmarklet tests execute the complete JavaScript URL from a link. Bookmark storage limits and provider CSP may still prevent installation/execution; use a userscript or the console in that case. No remote-code loader or policy bypass is introduced.
- Actual signed-in temporary-chat image/blob previews, ongoing/completed Deep Research tasks, enterprise workspaces, Gemini virtualization, and the original long-chat report remain live-provider release checks. Do not infer those results from fixture success.

The September 19 live-browser attempt was interrupted by an unavailable Chrome automation connection; native Safari inspection also timed out. No signed-in provider or native Safari compatibility result is claimed from those attempts.
