# Film schema v1

A film is one JSON object. It describes a complete look, travels as a file or a
pasted text, and imports only when it validates. The app refuses anything else
with a specific message and leaves the current look untouched.

```json
{
  "schema": 1,
  "id": "koda-64",
  "name": "KODA 64",
  "iso": "64",
  "look": {
    "exposure": 0, "contrast": 0, "saturation": 0, "warmth": 0, "tint": 0,
    "fade": 0, "split": 0, "shadow": "#2f6a72", "highlight": "#ffb46a",
    "grain": 0, "grainSize": 1.5, "vignette": 0, "softness": 0, "leak": 0,
    "flicker": 0, "aspect": "orig", "frame": "none", "date": false,
    "dateFmt": "ymd"
  }
}
```

## Root fields

| Field | Rule | Refusal message |
| --- | --- | --- |
| `schema` | Must be exactly `1`. Anything else, including a missing or string value, refuses. | `unknown film schema version 2 (expected 1)` |
| `id` | Non-empty string. Stable across saves: renaming a film keeps its id. | `film id is missing` |
| `name` | Non-empty string, display text. | `film name is missing` |
| `iso` | String, display text. | `film iso must be text` |
| `look` | Object with the look keys below. The original nineteen are required; `rotate` is optional with default `0` (v1 films import forever, PS-39). | `film look is missing` |

Unknown extra keys on the root object are ignored, so schema v1 can grow
without breaking older films.

## Look fields

All thirteen sliders carry numbers. Ranges come from the app's slider table;
a value outside the range, or a non-number, refuses with the range spelled out.

| Field | Range | Refusal message |
| --- | --- | --- |
| `exposure` | -100 to 100 | `exposure 500 is out of range (-100 to 100)` |
| `contrast` | -60 to 60 | |
| `saturation` | -100 to 80 | |
| `warmth` | -60 to 60 | |
| `tint` | -60 to 60 | |
| `fade` | 0 to 60 | |
| `split` | 0 to 100 | |
| `grain` | 0 to 100 | |
| `grainSize` | 1 to 4, step 0.1 | |
| `vignette` | 0 to 100 | |
| `softness` | 0 to 100 | |
| `leak` | 0 to 100 | |
| `flicker` | 0 to 100 | |

| Field | Rule | Refusal message |
| --- | --- | --- |
| `shadow` | `#rrggbb` hex colour, 3 bytes. | `shadow must be a #rrggbb colour` |
| `highlight` | `#rrggbb` hex colour, 3 bytes. | `highlight must be a #rrggbb colour` |
| `aspect` | A key of the engine's `ASPECTS` map: `orig`, `3:2`, `4:3`, `5:4`, `1:1`, `16:9`, `cine`, `instant`. (`sprocket` also validates; it applies automatically in sprocket frame mode and the Crop select never offers it.) | `unknown aspect "2:1"` |
| `frame` | `none`, `35mm`, `super8`, `instant`, `halfframe` or `sprocket`. | `unknown frame "polaroid"` |
| `rotate` | OPTIONAL, added after v1 shipped: `0` (default), `90`, `180` or `270`. Films written before the key existed import unchanged; when present, the value must be one of the four or the import refuses. | `unknown rotate "45"` |
| `date` | Boolean: the date stamp on or off. | `date must be on or off` |
| `dateFmt` | `ymd`, `mdy` or `dmy`. | `unknown date format "dmy2"` |

Missing keys refuse with `look is missing "key"`; unknown keys inside `look`
refuse with `unknown look key "key"`. A pasted body that is not JSON at all
refuses with `this is not JSON`.

## Where films live

Exported films download as `<film-id>.json`, with the same JSON on the
clipboard on request. Import accepts a pasted text or a `.json` file; both run
the same validation. The saved-film library and its persistence are described
in [the user guide](../user-guide.md#film-studio).
