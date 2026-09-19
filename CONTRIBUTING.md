# Contributing to ChatGPT Chat Exporter

Use Node.js 22.22.2+, 24.15.0+, or 26+. Node is only needed for development; the exported browser scripts have no runtime dependencies.

```sh
npm ci
npm run build
npm test
```

Edit `src/` and `scripts/`, then regenerate the shipped exporters and bookmarklets. Do not edit generated files directly. Tests reject stale artifacts. Every bug fix should include a synthetic regression fixture; never commit private conversations or authenticated captures. See [CLAUDE.md](CLAUDE.md) for the extraction architecture and provider pitfalls.

Open a pull request against `master` describing the problem, resulting behavior, and verification. Include relevant issue numbers. For selector changes, name the browser/provider shape you verified and distinguish live checks from synthetic tests. CI checks supported Node versions, generated artifacts, dependency advisories, and release packaging.

## Bug reports and requests

Use the issue templates. Include the installed exporter version, browser/userscript manager, provider, export format, and whether the conversation is temporary, shared, or stored. State whether the tab remained visible and whether images or Deep Research were involved. Share a minimal synthetic reproduction; do not paste tokens, private chats, or an unredacted selector-doctor report.

Report vulnerabilities according to [SECURITY.md](SECURITY.md). Questions and product ideas are welcome in [Discussions](https://github.com/rashidazarang/chatgpt-chat-exporter/discussions). Be respectful and constructive.

## Preparing a release

1. Set matching versions in `package.json` and `src/extraction-engine.js`; update the lockfile with `npm install --package-lock-only`.
2. Update README and add `temporal/release-notes-vX.Y.Z.md`.
3. Run `npm run release:prepare`. It builds, checks, tests, and prepares `dist/chatgpt-chat-exporter-vX.Y.Z/` with SHA256SUMS. It does not publish.
4. Complete the live browser checks in [the release audit](docs/RELEASE_AUDIT.md), review the diff and CI artifacts, and merge the release PR.
5. Tag the reviewed commit, publish its release notes and packaged assets, and verify the installed userscript version and distribution channels.
