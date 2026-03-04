# Book Completeness Review (2026-03-02)

This document records the current completeness status after a full pass over:

- Chapter index metadata
- Entity metadata/prompt generation
- Scene metadata/prompt generation
- Entity and scene image generation

## Scope and method

Coverage was audited by comparing:

- `data/book-index.json` + `data/chapters/*.html` chapter data
- `data/chapter-index.json` chapter/entity/scene metadata
- `data/entity-image-prompts.json` and `data/scene-image-prompts.json`
- Generated image files in:
  - `public/images/entities/<book>/*.webp`
  - `public/images/scenes/<book>/*.webp`

## Metadata completeness (what remains to be generated)

### Chapter metadata

- Chapters in book: **117**
- Indexed chapters: **117**
- Chapters missing index entry: **0**
- Chapters missing scene metadata: **0**
- Chapters missing entity metadata: **0**

### Prompt metadata

- Scene prompts missing: **0 / 641**
- Entity prompts missing: **1 / 913**
  - `pierre_morrel`

## Image coverage (for operational tracking)

### Entity images

- Present: **904 / 913**
- Missing: **9**
  - `pierre_morrel`
  - `police_at_monte_cristos_house_murder_and_theft`
  - `the_assizes`
  - `the_battle_of_navarino`
  - `the_duel_between_albert_and_beauchamp`
  - `the_duel_between_noirtier_and_general_dpinay`
  - `the_massacre_in_the_south_of_france`
  - `the_murder_at_the_inn`
  - `waterloo`

Chapters still missing at least one entity image:

- 13: `pierre_morrel`, `waterloo`
- 44: `the_massacre_in_the_south_of_france`, `waterloo`
- 45: `the_murder_at_the_inn`
- 69: `the_battle_of_navarino`
- 75: `the_duel_between_noirtier_and_general_dpinay`
- 78: `the_duel_between_albert_and_beauchamp`
- 92: `waterloo`
- 96: `police_at_monte_cristos_house_murder_and_theft`
- 108: `the_assizes`

### Scene images

- Present: **623 / 641**
- Missing: **18**

Chapters still missing at least one scene image:

- 15: `ch15-scene6`
- 18: `ch18-scene6`
- 19: `ch19-scene2`, `ch19-scene6`
- 20: `ch20-scene1`
- 23: `ch23-scene5`, `ch23-scene6`
- 41: `ch41-scene6`
- 45: `ch45-scene4`, `ch45-scene5`, `ch45-scene7`
- 83: `ch83-scene0`, `ch83-scene1`, `ch83-scene4`
- 86: `ch86-scene7`
- 89: `ch89-scene3`
- 93: `ch93-scene9`
- 103: `ch103-scene0`

## Summary

- **Metadata generation is complete for chapters/scenes/entities except one entity prompt (`pierre_morrel`).**
- Remaining gaps are concentrated in a small set of image files.
