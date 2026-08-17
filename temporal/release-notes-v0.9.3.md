# Release Notes — v0.9.3

## `404 (Not Found)` on `/backend-api/conversation/<id>`

Running any ChatGPT exporter from the console printed a red

```
GET https://chatgpt.com/backend-api/conversation/<id> 404 (Not Found)
```

for a conversation the reader was looking at, signed in, and owned.

**Cause.** chatgpt.com's private API does not accept cookies alone; it wants
the same `Authorization: Bearer …` header the app itself sends, taken from
`/api/auth/session`. It reports a request that lacks one as **404** with

```json
{"detail":{"message":"Log in to view this conversation.",
           "code":"conversation_inaccessible","can_retry":false}}
```

rather than 401 or 403. v0.9.2 fetched the bearer token only *after* a 401/403,
so the retry never ran. Every export silently lost its metadata pass and left
an error in the console that looked like a broken exporter.

**Fix.** The token is read once per export, up front, and attached to every
private-API call. Because the doomed cookie-only request is no longer made, the
console error is gone rather than merely handled. When a request is refused
anyway the exporter escalates only as far as it must — a refreshed token for a
session that rolled over mid-export, then each workspace account the reader may
act as (`ChatGPT-Account-Id`), which is what a Team/Enterprise member needs for
a conversation owned by the workspace rather than by them.

Verified against a live signed-in conversation: two requests
(`/api/auth/session`, then the conversation), both 200, no 404.

## The same class of bug, elsewhere in the metadata pass

- **`/backend-api/files/download/<id>` sent no token at all** — not even the
  401/403 fallback. It now carries the same credentials as every other
  private-API call, so attachment images can actually be embedded.
- **That endpoint reports failure as HTTP `200`** with
  `{"status":"error","error_code":"file_not_found",…}`, so `response.ok` says
  nothing about whether a file came back. The envelope is now recognized and
  falls back to the image placeholder.
- **The bearer token could have followed a signed download link off-origin.**
  The link points at a third-party CDN host; credentials are now attached only
  on a same-origin hop, so the reader's session can never be handed to it.
- **A refused read is no longer indistinguishable from a missing one.** A 404
  carrying an auth code triggers the escalation; any other 404 — a temporary
  chat, a shared link, a deleted conversation — stops after one request instead
  of enumerating workspaces for a conversation that does not exist.
- **No session, no request.** If `/api/auth/session` answers without a token the
  reader is signed out, and the private-API call is skipped rather than fired to
  produce a guaranteed 404 in their console.

## Diagnostics

A skipped metadata pass now says so, once, and says which of the causes it was —
`console.info`, not a red network error — and states that the conversation
itself exported normally. `conversation.metadataStatus` (`enriched` /
`unavailable`) records the same outcome for callers.

## Scope

The metadata pass remains strictly an enhancement over the DOM capture: it adds
per-turn timestamps, attachment names and bytes, generated `sandbox:` links, and
visible reasoning recaps. None of the above can prevent, delay past its
wall-clock budget, or truncate the normal export.

## Tests

57/57 passing (`npm test`). Six new regressions cover the reported 404 as an
auth failure, a signed-out reader making no doomed request, a genuinely missing
conversation *not* triggering the escalation, a workspace conversation read with
the account header, file downloads authenticating to chatgpt.com while never
leaking the token to the CDN, and the HTTP-200 error envelope.
