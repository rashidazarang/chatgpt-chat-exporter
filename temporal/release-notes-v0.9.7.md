# Release Notes — v0.9.7

The sweep is roughly **4× faster**, with identical output.

## Where the time was going

Every scroll step slept a fixed `scrollDelay` (350ms) before capturing —
whether or not the virtualizer had already rendered the turns the scroll
revealed. On a long conversation that fixed sleep *is* the export: a real
129,522px conversation needs 184 steps, so 64 seconds of a ~70 second export
was the exporter waiting on a timer it had no reason to trust.

## Waiting on the DOM instead

`awaitRenderSettled()` puts a `MutationObserver` on the scroll container and
resolves as soon as it has been quiet for 60ms, capped at the old `scrollDelay`.
It can only be faster, never less thorough:

- provider renders promptly → proceed in ~60ms instead of 350ms;
- provider is slow, or still streaming → the cap makes it behave exactly as
  before;
- no `MutationObserver` → falls back to the plain sleep.

Measured on a 40-message virtualized fixture, both runs capturing 40/40 with
`complete: true`:

```
fixed 350ms (old)     11086ms
mutation-settle (new)  2848ms
```

## One place that deliberately still sleeps

The loop that pins to the top of the conversation waits on a **network** fetch
of older history, which produces no DOM mutation until it lands. Settling on
quiet there would conclude "no more history" after 60ms and start the sweep
below the real top of the conversation — losing the oldest messages, which is
exactly the failure v0.8.0 existed to fix. It runs a handful of times, so the
saving was never worth the risk. The fixed delay stays, with a comment saying
why.

## The budget warning had to be rebalanced

v0.9.6 warned when the *worst case* exceeded `maxDuration`. With the sweep now
typically 4× cheaper, that fired on conversations which comfortably finish —
the same crying-wolf problem that got two other warnings demoted in v0.9.6.

`fitsBudget` now judges the typical cost with 2× headroom. The 129,522px
conversation that prompted the warning in v0.9.6 needs about 11s of a 120s
budget and is no longer flagged; a genuinely enormous one still is.

## Tests

71/71 passing, up from 70. The sweep-budget test was inverted to assert that
real-world geometry now fits, and a new test covers a conversation large enough
that it genuinely does not.
