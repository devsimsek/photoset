# Naming

The never-overwrite rule lives in `web-api.js` as `candidateName`. It is a
product law, not an implementation detail; see [The Laws](../laws.md).

## candidateName

`candidateName(name, attempt)` maps a desired file name to the name for the
attempt-th collision:

- `attempt 0` returns the name unchanged.
- **Strip names** (`strip_<digits>.jpg`) continue the number:
  `strip_001.jpg` with attempt 1 becomes `strip_002.jpg`. The existing digits'
  width drives `padStart`, so zero padding is preserved (a two-digit run stays
  two digits).
- **Any other name** inserts a copy number before the extension: attempt 1 turns
  `beach.jpg` into `beach (2).jpg`, attempt 2 into `beach (3).jpg`. Files without
  an extension get the suffix at the end. Case is preserved.

## Two sets to dodge

Two different collections of existing names are checked, depending on the save
mode:

1. **The batch-level set** (download mode, where results do not hit disk one by
   one). `beginBatch` starts a fresh `names` set; every `writeFile` adds its
   chosen name (lowercased) and skips past any name already taken in this run,
   so the same run never emits two files with the same name. This is what makes
   `DSC_0001.jpg` develop once and download once even when two source files
   would map to the same output name.
2. **The on-disk set** (folder mode, Chrome/Edge). `uniqueFileHandle` probes the
   destination folder with `getFileHandle(n)` for `attempt = 0, 1, 2, …` until
   one misses (`NotFoundError`), then creates it. The folder is the source of
   truth, so a file saved in an earlier run also gets dodged.

Both loops share the same cap (10,000 attempts) and give up loudly rather than
overwrite.

## Examples

Folder already contains `strip_001.jpg` through `strip_003.jpg`:

| Desired | Tries | Saves as |
| --- | --- | --- |
| `strip_001.jpg` | `strip_001` taken, `strip_002` taken, `strip_003` taken | `strip_004.jpg` |
| `strip_01.jpg` (2-digit run) | `strip_01` taken | `strip_02.jpg` |
| `beach.jpg` | `beach.jpg` taken | `beach (2).jpg` |
| `beach.jpg` again, same batch | `beach (2).jpg` in the batch set | `beach (3).jpg` |

Note the strip case continues to the next free number rather than `max + 1`:
if `strip_002.jpg` is free but `strip_003.jpg` exists, a new strip still takes
`strip_002.jpg`.
