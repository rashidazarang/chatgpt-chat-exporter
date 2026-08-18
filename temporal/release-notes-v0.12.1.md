# Release Notes — v0.12.1

Gemini maths, audited against a live conversation for the first time — which
caught a regression v0.11.0 had introduced a few hours earlier.

## v0.11.0 would have deleted every formula from a Gemini export

v0.11.0 taught the exporter that maths renderers emit two copies of each
formula: an accessible one carrying the TeX, and a visual one. When no TeX was
found it removed the visual copy, so a formula appeared once rather than twice.

**Gemini has no accessible copy.** It renders KaTeX as `.katex-html` alone — no
`.katex-mathml`, no `<annotation>`, no MathML anywhere. The "duplicate" is the
only copy there, and removing it left nothing:

```
.katex          →  Cs+pD<Cr
after removal   →  ""
```

De-duplication is now conditional on an accessible representation actually
surviving it. Verified on the live page: **0 formulas emptied**.

## And Gemini maths now export as real TeX

Gemini does keep the source — in a `data-math` attribute on the wrapper *around*
the rendered KaTeX, which the previous attribute list did not check and which
sat outside the elements treated as maths roots:

```html
<div class="math-block" data-math="W_s = -C_s + \delta [p(V - D) + (1 - p)\Pi_s]">
  <span class="katex-display">…rendered glyphs…</span>
</div>
```

`data-math` is now read, the wrapper is now a maths root, and display detection
looks **down** for `.katex-display` as well as up — the source-carrying element
is the parent of the display marker, not its child.

Verified against the live conversation: **42 maths roots, 42 TeX recovered**, 6
display and 36 inline, none emptied. Gemini formulas export as
`$$W_s = -C_s + \delta [p(V - D) + (1 - p)\Pi_s]$$` rather than as the rendered
glyph soup `Ws=−Cs+δ[p(V−D)+(1−p)Πs]`.

## Tests

101/101 passing, up from 99. Two new tests built from the real Gemini markup —
TeX recovered from the wrapper with correct display/inline classification, and a
formula whose only copy is visual surviving intact. Both mutation-checked
against the v0.11.0 behaviour.
