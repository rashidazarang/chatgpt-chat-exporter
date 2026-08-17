# The `legacy/v1.x` tags

`legacy/v1.0.0` and `legacy/v1.1.0` label a **different repository history** from
the one `master` records. They are kept, under a deliberately non-semver name,
so that history stays reachable and explicable.

## What they are

March 2025, before the repository was restarted. Two facts make them confusing
if met without context:

- **They belong to a disjoint history.** `master` and the v1.x line share *no*
  commits — not a divergence, two separate roots. `master`'s root commit is
  `63f7d51`, the v0.3.0 release; the v1.x line roots at `b65c59c`. The commits
  survive only on the `rashidazarang-patch-1` / `rashidazarang-patch-2`
  branches, which were never merged.
- **The `1.x` numbers were never project versions.** They versioned the
  *userscript files* — see `temporal/release-notes-v0.3.0.md`, which refers to
  "`chatgpt-pdf-exporter.user.js` v1.1.0". The project's own line starts at
  v0.3.0 and has run forward from there.

| tag | commit | date | on `master`? |
| --- | --- | --- | --- |
| `legacy/v1.0.0` | `6383eb9` "Add MIT license" | 2025-03-24 | no |
| `legacy/v1.1.0` | `7b87008` "Add userscript versions…" | 2025-03-24 | no |

## Why they were renamed

They were previously tagged `v1.0.0` and `v1.1.0`. As bare semver tags they
outranked every real release: `git tag --sort=-v:refname | head -1` answered
`v1.1.0`, and any tooling that picks the highest version tag landed on an
orphaned 2025 commit instead of the current release. Because the project
numbers below 1.0.0, that could never resolve itself.

Renaming into the `legacy/` namespace fixes the ordering without deleting
anything: the commits stay reachable, and the highest semver tag is once again
the newest release.

The v1.0.0 GitHub release — the project's original announcement — was retargeted
onto `legacy/v1.0.0` rather than deleted, so its text and publication date are
intact. Its URL moved with it.

## Rule

The tag namespace describes *this* repository's lineage. A tag that labels
anything else does not get a bare `vX.Y.Z` name.
