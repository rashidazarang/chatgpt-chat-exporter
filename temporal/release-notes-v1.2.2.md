# v1.2.2 — interrupted replies, and the right date

Found by a real 93-message Markdown export made on 2026-09-25, which v1.2.1
flagged as incomplete.

## Fixes

- **False "may be incomplete" warnings.** ChatGPT keeps a reply that was
  stopped, failed or abandoned in its record for good, as `in_progress` or
  `finished_partial_completion`. Any such record anywhere in a conversation
  marked the whole export incomplete, although the export held everything
  ChatGPT did. Only the conversation's final turn can still be being written,
  and it is judged by its answer, so a stale tool call beside a finished
  answer no longer counts either.
- **A reply interrupted before any text was saved vanished**, leaving two of
  your prompts in a row. It now appears as ChatGPT's turn, saying the reply
  was interrupted before any text was saved.
- **A reply stopped part-way now says so.** "This response was not finished
  in ChatGPT; it ends here." closes it, in Markdown, HTML and PDF-ready
  exports alike.
- **A reply stopped inside a code block left its fence open**, so Markdown
  viewers rendered every later message as code. The fence is closed where the
  reply ends, as ChatGPT's own renderer does.
- **Exports were dated by UTC.** An evening export in the Americas was dated
  the next day in its header and file name; the date is now the reader's
  calendar day.

## Unchanged

A final answer that is still being written keeps the export marked
incomplete. Replies ChatGPT never finished are shown as ChatGPT stored them;
the exporter cannot recover text that was never saved.
