# Release Notes — v0.10.0

A long export used to be indistinguishable from a frozen tab. It now shows its
work in the page.

## The progress card

Every console exporter and both userscripts now mount a small card over the
conversation while a sweep runs:

```
Chat Exporter
Reading conversation…
████████████░░░░░░░
18 messages · 1,240 lines
ChatGPT: Start by draining the write queue, the…
```

It reports the phase (waiting for a streaming answer, reading, adding
timestamps), how far through the conversation it is, how many messages and lines
have been read, and a preview of the message it just captured.

**An incomplete export does not end on a green bar.** When the sweep finishes
short of the message count ChatGPT's own payload reports, the bar turns amber
and says so:

```
Incomplete — 10 message(s) never loaded
22 of 32 messages · 1,610 lines
```

It also turns amber and says "Paused — bring this tab to the front" when a
backgrounded tab suspends the sweep, which previously appeared only as a single
console warning that was easy to miss.

Nothing about how you run an export changes: paste the same one file you always
have.

## Built to be unable to break an export

This draws into a page the exporter is simultaneously reading, on deployments
that enforce Trusted Types, for everyone already running the tool. Each
constraint below is a failure this project has already paid for once:

- **The engine emits events; it never draws.** `options.onProgress` is a plain
  callback, so the engine stays headless-testable, and a listener that throws is
  swallowed. A broken card costs a progress bar, never a file.
- **No HTML injection sinks.** Nodes are built with
  `createElement`/`textContent` and styled per-property — no `innerHTML`, and no
  injected stylesheet. A test builds the whole card with every HTML sink
  throwing.
- **The card cannot be exported by the sweep watching it.** It is a direct child
  of `body`, outside the conversation container, carries no message markers, and
  is `position: fixed` so it cannot change the container's scroll height
  mid-sweep. `isValidMessage` additionally refuses anything inside
  `[data-chat-exporter-ui]`.
- **`pointer-events: none`** — it can never intercept a click.
- It removes itself when the export finishes, and gets out of the way if it
  cannot draw.

## Tests

80/80 passing, up from 73. Seven new tests: the card builds where `innerHTML`
throws; it is never captured as a message; an export survives a progress
listener that throws on every event; progress events report the phases, line
counts and captured content; a document with no body degrades to a no-op; the
built runner mounts the card and cleans it up without it reaching the file; and
anything marked as exporter UI is refused even in a position where a message
would be taken — that last one mutation-checked to confirm it fails without the
guard.
