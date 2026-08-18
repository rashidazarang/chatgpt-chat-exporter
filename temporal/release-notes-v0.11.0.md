# Release Notes — v0.11.0

Two capabilities rather than fixes, hence the minor bump.

## Math from every renderer, and never twice

Math handling recognised exactly two sources: a MathML `annotation` with a TeX
encoding, and a MathJax v2 `script[type^="math/tex"]`.

The second had **never worked**. `removeUiElements` strips `<script>` and runs
before `processMath`, so the source was deleted before anything could read it.
That branch was dead for as long as it existed. Math scripts are now exempt from
stripping.

TeX is now recovered from, in order:

- `annotation` / `annotation-xml` with a TeX encoding — KaTeX, MathJax v3;
- `data-latex`, `data-tex`, `data-formula` attributes;
- a MathJax v2 `script[type^="math/tex"]`.

The subtler half is what happens when **none** of them is present. Every
renderer emits two copies of a formula: an accessible one and a visual one.
Without a source to substitute, both were serialized and the export read
`f(x)f(x)`. The visual copy (`.katex-html`, `aria-hidden` content inside
`mjx-container`) is now removed, so the formula appears once.

## Earlier versions of regenerated and edited turns

Regenerating an answer or editing a prompt leaves the previous version in the
conversation payload as a sibling branch. The export walks only the branch
currently on screen, so those versions were invisible — present in the
conversation's history, absent from every export of it.

`includeVariants: true` appends them next to the turn that replaced them, each
labelled *"Earlier version (replaced by a regeneration or edit)"*:

```js
ChatExporterEngine.exportConversationFull({
  provider: 'chatgpt', format: 'markdown', includeVariants: true
})
```

**It is off by default**, deliberately. Turning it on would change the shape of
every existing user's export without them asking. When a conversation has
variants the export now says so, and how to include them.

Not verified against a live branched conversation — the conversation used for
testing had 42 nodes and no branch points. The behaviour is covered by tests
against a synthetic branched payload.

## Tests

92/92 passing, up from 88. New: TeX recovered from all four carriers with the
visual duplicate suppressed; a formula with no TeX source appearing once rather
than twice; variants excluded by default but counted; variants included,
labelled and correctly positioned when asked for. All mutation-checked.
