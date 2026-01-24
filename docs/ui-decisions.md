# UI Decisions – WineForm (Phase 1)

This document records **explicit UI design decisions** for the WineNotes Tasting Form.
Its purpose is to **freeze design intent**, reduce implementation ambiguity, and
prevent future regressions caused by ad-hoc UI changes.

This is not a spec sheet or a visual design doc.
It is a log of *why* certain UI patterns are chosen.

---

## Overall Direction

- The WineForm is designed as a **tasting experience**, not a generic data entry form
- The SAT structure (Appearance → Nose → Palate → Conclusion) must be visually explicit
- Sections are separated using cards to indicate shifts in evaluation focus
- Whitespace is used intentionally:
  - Generous spacing **between SAT sections**
  - Compact spacing **within sections**
- Wine and the user's own judgment are the primary focus; AI content is strictly secondary

---

## Adopted Patterns

### Layout

- Single-column layout, centered
- Width optimized for reading and writing, not full-width
- SAT stages are separated using `SectionCard` components
- No multi-column layout in Phase 1 (including desktop)

Rationale:
The tasting process is sequential and reflective.
A single vertical flow best supports concentration and continuity.

---

### Appearance

- Appearance is treated as a **training surface** to improve sensory resolution
- Key attributes (clarity, intensity, color nuance) use **continuous sliders**
- Sliders are **anchored to WSET terminology** (e.g. Pale / Medium / Deep)
- No numeric values (percentages or scores) are displayed
- The current value is always expressed in **language**, not numbers
- Sliders snap softly to semantic anchor points
- Visual weight is kept light to allow users to move through Appearance quickly

Rationale:
Appearance evaluation benefits from fine-grained calibration over time.
Continuous sliders support perceptual training while language anchors preserve WSET rigor.

---

### Nose – Aroma Selection

- Aroma input is **search-first**, prioritizing recall over recognition
- Typing is not mandatory to start selection:
  - Recently used aromas are shown on focus
  - Frequently used aromas may be suggested
- A structured category browser (WSET hierarchy) is available **on demand**
- Structured lists are not shown by default to avoid visual overload
- Selected aromas are displayed as chips
- Primary / Secondary / Tertiary aromas are visually separated
- Aroma intensity uses a single horizontal slider with semantic labels

Rationale:
Recall-based input strengthens tasting skill development.
Structured browsing exists as a support tool, not the primary interaction.

---

### Palate

- Palate attributes remain slider-based to reflect continuous evaluation
- Sliders are grouped tightly to reduce vertical sprawl
- Labels are visually subdued
- Current values are visually emphasized
- No numerical scores are shown during input

Rationale:
Palate assessment involves relative comparison rather than categorical choice.
The UI should emphasize perception, not scoring mechanics.

---

### Conclusion

- Conclusion represents a **judgment moment**, distinct from observation
- Quality assessment uses segmented buttons
- Readiness for drinking uses large, selectable cards
- This section has slightly higher visual emphasis than previous sections

Rationale:
Conclusion is the cognitive endpoint of the SAT process.
The UI should encourage deliberate, confident decision-making.

---

### AI Deep Dive

- AI Deep Dive content is collapsed by default
- Positioned after the Conclusion section
- AI-generated text is presented as reference, not authority
- “Generate full report” is an explicit, user-triggered action

Rationale:
AI is a learning and comparison tool, not a replacement for sensory judgment.
User evaluation must come first.

---

### Footer / Save Behavior

- A sticky footer save bar is always visible
- Save state is explicitly shown (e.g. “Draft saved”)
- Primary action is “Save Note”
- The UI must minimize anxiety around data loss

Rationale:
The form is long and cognitively demanding.
Users should be able to focus entirely on tasting and writing.

---

## Non-Goals (Phase 1)

- Full customization of UI density
- Multi-column desktop layouts
- Gamification or scoring visualizations
- AI-driven auto-filling of tasting fields

These may be explored in future phases but are intentionally excluded here.

---

## Guiding Principle

When in doubt:

> **Favor clarity of thought over speed of input.**  
> **Favor language over numbers.**  
> **Favor restraint over decoration.**

This document takes precedence over visual mockups or one-off design ideas.
