# Release Notes — v0.10.2

Two more defects from auditing a real export, both of which had been shipping in
every ChatGPT file this tool produced.

## "#### ChatGPT said:" in front of every message

ChatGPT labels each turn with

```html
<h4 class="sr-only select-none">ChatGPT said:</h4>
```

It is 1x1px and positioned off-screen — invisible to a reader, present for
screen readers. The exporter read it as a heading, so **every** exported
message opened with a redundant `#### You said:` or `#### ChatGPT said:`. In the
32-message conversation that surfaced this, 30 of them did.

Screen-reader-only elements are now stripped with the rest of the interface
chrome, matched by class (`sr-only`, `visually-hidden`, `cdk-visually-hidden`)
rather than by text — a message whose own heading legitimately ends in "said:"
is untouched, and there is a test for exactly that.

## Recovered messages had no timestamp

The messages v0.10.1 recovers from the conversation payload were the only ones
in a file without a timestamp — while the payload carries `create_time` right
next to the text being recovered. They now get it.

## Tests

86/86 passing, up from 84. Both fixes mutation-checked: removing either one
fails its test.
