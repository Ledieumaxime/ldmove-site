# Legacy scripts — DO NOT RUN

These scripts reference the old Google Drive workflow
(`Bibliothèque/bibliotheque.md` with Drive URLs). They are kept for
reference only and will be deleted when the Drive migration is fully
sunset.

## Active replacements

| Legacy | Replaced by |
|--------|-------------|
| `seed-exercises-from-md.mjs` | `seed-exercises-from-review.mjs` |
| `import-program-cowork.mjs` | `import-program-from-md.mjs` |
| `build-biblio-review.mjs` | _(no replacement — the review file is now hand-curated)_ |
| `create-test-block-from-bucket.mjs` | _(one-off test script, no replacement needed)_ |

The active library reference for Cowork is now
`Bibliothèque/exercises_canonical.md` (regenerated via
`scripts/build-exercises-canonical.mjs`).
