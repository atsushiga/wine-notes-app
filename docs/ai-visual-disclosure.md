# AI Visual Disclosure Rules

Wine Notes displays generated and sourced visual assets with explicit labels so users can distinguish illustrative AI images from real source images.

## Asset Labels

- `source`: Display as `出典画像`. Use only when the image URL points to a real external source image.
- `source-backed-generated`: Display as `出典情報をもとにAI生成`. Use when the image itself is AI-generated, but the prompt or concept is based on cited producer, importer, or official information.
- `generated`: Display as `AI生成画像`. Use for illustrative AI-generated visuals without a direct source image.

## UI Rules

- Every visual result image with an asset kind must show its label on the image overlay.
- If `sourceUrl` exists, show a source link near the image and in the expanded lightbox.
- Do not present AI-generated images as actual producer photos, vineyard photos, maps, or dish photos.
- Captions should describe what the image represents, not imply documentary accuracy when the image is generated.

## Content Rules

- Prefer official winery, producer, importer, or distributor pages for `sourceUrl`.
- Generated producer visuals should be treated as editorial illustrations even when source-backed.
- Generated map, aroma, and pairing visuals should be treated as explanatory illustrations.
- If no reliable source is available, omit `sourceUrl` rather than citing a weak or unrelated page.
