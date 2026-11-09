# Changelog notes (one file per pull request)

Every pull request adds **its own small file here** instead of editing the top of
`docs/CHANGELOG.md`. Two PRs never touch the same file, so merging one no longer causes
a "merge conflict" in the next one (that happened on almost every merge in Nov 2026).

## How to add a note
- File name: `YYYY-MM-DD-<short-topic>.md`, e.g. `2026-11-09-van-per-person.md`.
- Content: the same line as before, one or more bullet lines:
  `- YYYY-MM-DD — <AI or Jorge> — <what changed>`

## Reading what changed
The newest changes are **the files in this folder** (newest date first), then the top of
`docs/CHANGELOG.md`.

## Folding notes into CHANGELOG.md
Every few weeks (or when this folder has many files), Claude opens a small PR that moves
the notes into the top of `docs/CHANGELOG.md` (newest first) and deletes the note files.
That PR touches nothing else, so it can't conflict with feature work.
