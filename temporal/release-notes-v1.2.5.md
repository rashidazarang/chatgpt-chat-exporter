# v1.2.5 — header exports for temporary chats

When a populated conversation has no native Share control, a Share-style button now appears in the conversation header with Markdown and PDF export options. It supports temporary-chat headers where Save chat is wrapped directly inside the action container. The floating Export pill is removed.

The fallback disappears when ChatGPT's real Share control returns or the conversation becomes empty. Existing native Share behavior and export formats remain available for standard chats.

Synthetic browser regressions cover both installers, temporary headers, navigation, and downloads under strict CSP across Chromium, Firefox, and WebKit. Installer, package, and engine versions are aligned at 1.2.5.
