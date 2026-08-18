# Release Notes — v0.10.3

Found by auditing an export against the conversation it came from.

## Inline citations exported as a wall of base64

ChatGPT renders an inline citation as a favicon and a label inside a single
link. Media is serialized before links, so by the time the link was written its
text already held the image markdown — which then got escaped into it:

```
[!\[Image\](data:image/png;base64,iVBORw0KGgo…)MetaMCP+1](https://metamcp.org/…)
```

That is not a link. It renders as literal backslashes and a base64 blob in the
middle of a sentence. Nine of them were in one export.

Link text now takes the label and drops the media, giving the intended
`[MetaMCP+1](https://metamcp.org/…)`.

A link whose *only* content is an image keeps the image instead, nested properly
and without escaping the exporter's own syntax — `[![alt](src)](href)` — so a
picture that links somewhere still survives.

HTML and PDF exports were never affected: their media travel as opaque
placeholders, so `<a><img></a>` already nested correctly.

## Tests

88/88 passing, up from 86. Two new tests — a citation chip exports as its label
with no `data:` text and no escaped image markdown, and an image-only link keeps
its image while remaining a link. Both mutation-checked against the old
behaviour.
