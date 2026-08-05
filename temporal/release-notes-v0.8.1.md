# Release Notes — v0.8.1

## The export UI no longer depends on ChatGPT's Share button

### Floating Export button returns as a fallback — issue #31

v0.8.0 moved exports into ChatGPT's native conversation (•••) and Share menus
and dropped the floating button. That works only where ChatGPT offers a share
affordance to attach to. On accounts where sharing is disabled by policy
(enterprise/Team workspaces), there is no Share button in the header and no
Share entry in the conversation menu — so v0.8.0 exposed no export control at
all. Reported by @n8henrie on Firefox + Violentmonkey.

The userscript UI now treats native-menu integration as an enhancement and
guarantees its own entry point:

- A floating **Export** button mounts whenever no share control is visible on
  the page, opening the same menu (**Copy link**, **Export to Markdown**,
  **Export to PDF**). **Share…** is omitted there, since there is no native
  share dialog to hand the click back to.
- The button hides itself as soon as a share control appears, so accounts with
  sharing enabled keep the clean native-menu experience from v0.8.0. Detection
  re-runs on every DOM mutation, which covers ChatGPT's client-side navigation.
- It stays out of the way on the landing page and brand-new chats: the launcher
  only mounts once the page actually has conversation messages (matched with the
  engine's own provider selectors), and only after a short settle delay so it
  never flashes in ahead of ChatGPT's header.

### Console escape hatch

The userscript now exposes a small API on `window`, so an export is reachable
even if every ChatGPT surface we hook into changes again:

```js
ChatExporter.markdown()      // export the open conversation to Markdown
ChatExporter.pdf()           // export to print-ready HTML
ChatExporter.showLauncher()  // force the floating button on and keep it there
```

### Strict-CSP / Trusted Types hardening

Menu items, icons, and the launcher are built with DOM APIs; SVG icons are
parsed with `DOMParser` and imported as nodes. No shipped code assigns
`innerHTML`, `outerHTML`, `insertAdjacentHTML`, or calls `document.write`, so
pages that enforce `require-trusted-types-for 'script'` cannot break the UI. A
regression test runs the built userscript on a page where every HTML sink throws
and asserts that installing and exporting still work end to end.

### Localized menu entries are labelled correctly

Cloned •••-menu entries used to be relabelled only when the source item's text
was literally `Share`. On a non-English ChatGPT — where v0.8.0 started matching
the share item by `data-testid` — the clones kept the original localized label,
so the menu showed the same entry three times. The clone's first text node is
now replaced whatever it says.

### Menu-clone hygiene

Export entries cloned from ChatGPT's Share item now have their `id`,
`data-testid`, and `data-test-id` attributes stripped (including on descendants),
so ChatGPT's own queries can never match our copies instead of its item. Menus
without a Share entry are deliberately left untouched: every menu reaching that
code — including the per-conversation menus in the sidebar — would export the
conversation that is currently open, so exports are only added next to a
whole-conversation action ChatGPT itself offers. Those accounts get the floating
launcher instead.

## Tests

30/30 passing (`npm test`): 10 new regression tests covering launcher mounting
and hiding, menu contents without a native share, launcher toggling, the empty
chat page, the forced launcher, clone hygiene, the console API, and two
end-to-end runs of the built userscript (plain, and under simulated Trusted
Types) that click through to an actual downloaded Markdown file.
