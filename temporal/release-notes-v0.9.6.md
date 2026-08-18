# Release Notes — v0.9.6

Two findings from running v0.9.5's own health check against a real 30-message
ChatGPT conversation. Neither was reachable from the test fixtures.

## An export can be short and still claim to be complete

`conversation.complete` was a heuristic: no turn mounted-but-unreadable, no
deadline overrun, no stream still running. All three can hold while the sweep
quietly stops before reaching the top of a long conversation — every turn it
*saw* captured cleanly, and a short file reported as whole.

The ChatGPT payload already knows how many messages the conversation has. The
export now compares against it and reports `expectedMessages` /
`unreachedMessages`, with `complete` false when any message was never reached.

**It compares ids the sweep encountered, not counts.** Content dedupe
deliberately collapses two byte-identical turns into one, and a count check
would call that a missing message. Both behaviours are pinned by tests.

## A long conversation can exceed its own sweep budget silently

The conversation that surfaced this has a 129,522px scroller in a 936px
viewport. At `clientHeight × 0.75` per step that is **184 scroll steps** — 64s
at best, 129s when turns mount late — against a **120s** default `maxDuration`.
The only symptom was a truncated file and an after-the-fact warning.

`diagnose()` now estimates the sweep from the page's own geometry and warns
before you export, naming the cost and the call that raises the budget:

> This conversation needs about 184 scroll steps — 64s at best, 129s if turns
> mount slowly — against a 120s budget. Export with a larger maxDuration, e.g.
> `ChatExporterEngine.exportConversationFull({ provider: 'chatgpt', format:
> 'markdown', maxDuration: 210000 })`.

## Warnings that fired on healthy pages

Two of them, both demoted:

- *"Every titleSelector missed; the title comes from the tab"* — since v0.9.5
  that is Gemini's **designed** path (`preferDocumentTitle`), not a fallback.
  It now fires only for providers that don't prefer the tab.
- *"The conversation has 30 messages; 5 are in the page"* — true of every
  virtualized conversation and not a problem. Moved to a new `notes` list.

`diagnose()` now separates `notes` (context) from `warnings` (act on this). A
warning list that cries wolf stops being read, which defeats the point of
having built one.

## Tests

70/70 passing, up from 66. New coverage: a short export not reported as
complete, deliberate dedupe *not* counted as a missing message, the sweep-budget
warning at the real-world geometry that prompted it (asserting the 184-step
figure), and a conversation that fits its budget staying quiet.
