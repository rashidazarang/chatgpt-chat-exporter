# v1.2.5 — GPT-6 interface replies export as readable Markdown

Some GPT-6 replies are an interface rather than prose: options to choose from, a button, a link card, a framed example. ChatGPT stores the model's source for that interface (Markdown mixed with component tags such as `<radio-group>`, `<row>`, `<Link>` and `<Cite>`, `{@body …}` state and click handlers) as the reply, and compiles it into the controls the reader sees. Markdown exports read the stored reply, so that source was written into the `.md` file, with tags, state and handlers (issue #47).

Markdown exports now contain what the reader could read:

- The Markdown version ChatGPT stores beside each interface (`fallbackMarkdown`) is exported when present, including its citations.
- A reply stored without that version is converted from its source. Options become a list in the order offered, a button keeps its label, links and citations become Markdown links, dividers become rules, and code and maths keep their exact text. State, handlers and layout attributes are removed.
- Ordinary replies are unchanged byte for byte. Code that mentions component tags is left as written. A prompt is never rewritten, even when it contains interface source.

## Implementation

- `payloadRenderableMessage` reads an assistant record's text from `metadata.model_dil*.fallbackMarkdown` when one exists; image and file pointers in the record are kept.
- `renderDilSource` converts a reply only on evidence found outside code: a `{@body` line, a lower-case layout or control tag with an expression attribute such as `gap={3}` (HTML never has one), or a component such as `<Cite ref=…/>` that has attributes. Names are case-sensitive. Generics such as `Option<Card>`, custom elements such as `<mat-card>`, HTML such as `<col>`, Svelte blocks, JSDoc `{@link}` and React handlers in prose are left as written.
- The conversion skips fenced and inline code, removes `{@body …}` lines, and keeps the text of every `{#if}`/`{#each}` branch. It drops `{value.path}` bindings and leaves TeX braces alone. Elements that hold nothing never take the text after them. Tag, statement and binding lengths and nesting depth are bounded, so malformed input runs in linear time without exhausting the stack.
- A Deep Research report and a user's prompt are never converted.
- The fallback's location comes from a third-party description of the feature (openui.com, 2026-10-08); it has not been checked against a live payload. Any `model_dil*` key is read. When no fallback is found, the converter applies.
- HTML and PDF exports read the page, as before. They use the same text only for messages they rebuild from the stored record.

## Validation

- 13 new regressions cover the issue's shapes: options and a button; a link row with a citation; a framed example holding a heading, maths, a table and code; a code component; a template-literal handler; a reply cut off mid-stream; void elements and unclosed rows; a pasted prompt; a Deep Research report; JSX in prose; and four adversarial inputs. 13 samples of ordinary Markdown must pass through unchanged.
- An independent review of the first version found that the detection fired on ordinary Markdown such as `Option<Card>`, `{#if}`, `{@link}`, `<mat-card>` and `<col>`. It also found that a divider could swallow text and that deep nesting could overflow the stack. Each finding was reproduced, fixed and pinned by a test above.
- On the parent commit, the three end-to-end reproductions fail; the new unit checks fail there because `renderDilSource` does not exist; the pasted-prompt guard passes on both.
- The full suite passes: 217 tests.
- Not done: a check against a live GPT-6 interface reply. The browser extension used for live checks was not connected.

Reported by @meyumei, who also proposed a conversion in #48. This release draws on that proposal's test shapes and on the review findings left on it.
