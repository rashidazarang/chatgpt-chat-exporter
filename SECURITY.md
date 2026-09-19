# Security policy

Security fixes target the latest release. Update both the exporter and your userscript manager before reporting an issue.

## Reporting a vulnerability

Do not post conversation contents, session tokens, cookies, signed download URLs, or authenticated page captures in a public issue. Use [GitHub private vulnerability reporting](https://github.com/rashidazarang/chatgpt-chat-exporter/security/advisories/new) when available, or email the maintainer at rashid.azarang.eg@gmail.com. Include the exporter version, browser, a synthetic reproduction, and the impact you observed.

## Trust and privacy boundaries

The exporter runs in the provider page. It reads the rendered conversation and, on ChatGPT, makes authenticated reads of the current conversation, account metadata, files, and available Deep Research tasks. It does not send conversation content to a project-operated server or analytics service. Signed image downloads may contact the provider's CDN without forwarding the ChatGPT bearer token or account header. Authenticated API requests refuse redirects; downloaded HTML disables scripts, forms, and base URL changes.

Exported files can contain private messages, filenames, images, citations, and timestamps. Exact conversation URLs are omitted by default. Remote image fallbacks can contact their original hosts when a file is opened. Markdown retains the original message text, including any literal HTML: use a viewer that sanitizes untrusted Markdown.

Userscripts installed from the default branch automatically receive updates. For a fixed, reviewable version, use a full-commit raw URL or a release artifact and verify its SHA256SUMS. Bookmarklets embed a fixed copy and must be replaced manually to update.
