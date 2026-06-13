---
name: WineNotes Design System
version: 2026-06-13
status: implementation-ready
design_intent: "AI-powered personal wine intelligence workspace"
colors:
  canvas: '#070A0F'
  sidebar: '#08111D'
  surface: '#121821'
  surface-elevated: '#1A2230'
  surface-highest: '#202B38'
  border: '#2A3445'
  border-subtle: 'rgba(216, 227, 246, 0.08)'
  text: '#F4F1EA'
  text-muted: '#8E99AA'
  text-soft: '#BFC7D9'
  wine-red: '#E0184D'
  wine-red-soft: 'rgba(224, 24, 77, 0.14)'
  gold: '#C7A15A'
  gold-soft: 'rgba(199, 161, 90, 0.14)'
  success: '#2BC48A'
  warning: '#C7A15A'
  error: '#FF6B6B'
typography:
  display-wine:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-wine-mobile:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.12'
    letterSpacing: -0.02em
  headline-editorial:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-ui:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.45'
  label-caps:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.06em
  mono-data:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  default: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  max-width: 1440px
---

# WineNotes Design System

## 1. Product Positioning

WineNotes is an **AI-powered personal wine intelligence workspace**.

It is not a generic admin dashboard, and it is not a decorative luxury wine magazine. It should feel like a daily-use professional workspace for serious wine lovers, collectors, critics, and tech-savvy enthusiasts.

The ideal balance is:

```text
AI / SaaS workspace precision: 40%
Premium wine culture:          40%
Everyday wine-recording joy:   20%
```

## 2. Brand & Style

The brand personality is authoritative yet approachable.

The style is **Corporate Modern with a Minimalist Editorial edge**:

- Corporate Modern: compact, precise, fast, useful, data-aware.
- Minimalist Editorial: wine names, estate names, label photos, and AI insights are given room to breathe.
- Wine culture is expressed through typography, label imagery, and restrained gold/red accents rather than heavy ornamentation.

References for direction:

- Linear / Raycast / Vercel for workspace precision.
- Vivino / InVintory for image-led wine browsing.
- Editorial wine reports for AI Analysis pages.

## 3. Core Design Principles

### 3.1 Wine labels are first-class data

Wine label photos are the strongest memory trigger in the app. They should be visually prominent in:

- wine list cards
- wine detail hero
- AI analysis hero
- empty / loading states where appropriate

Avoid making the app feel like a text database.

### 3.2 AI should feel central, not bolted on

AI features should be represented as structured insight panels, verdicts, chips, and research-report sections.

The AI experience should answer:

- What is this wine?
- What does it taste like?
- Why does it taste that way?
- When should I drink it?
- What should I pair it with?
- How does it fit my preferences?

### 3.3 Luxury through restraint

Avoid heavy gradients, beige luxury clichés, excessive gold, or decorative borders. Use dark tonal layering, elegant typography, large label imagery, and precise spacing.

### 3.4 Daily usability wins

The app must remain fast and comfortable for repeated use. Forms, navigation, filters, and mobile interactions should be practical before decorative.

---

# 4. Color System

## 4.1 Core Tokens

```css
--color-canvas: #070A0F;
--color-sidebar: #08111D;
--color-surface: #121821;
--color-surface-elevated: #1A2230;
--color-surface-highest: #202B38;

--color-border: #2A3445;
--color-border-subtle: rgba(216, 227, 246, 0.08);

--color-text: #F4F1EA;
--color-text-muted: #8E99AA;
--color-text-soft: #BFC7D9;

--color-wine-red: #E0184D;
--color-wine-red-soft: rgba(224, 24, 77, 0.14);

--color-gold: #C7A15A;
--color-gold-soft: rgba(199, 161, 90, 0.14);
```

## 4.2 Usage Rules

### Canvas

Use `#070A0F` for the deepest app background.

### Sidebar

Use `#08111D` for desktop navigation. It should be visually stable and quieter than the main content.

### Cards

Use `#121821` for normal cards and `#1A2230` for elevated or active cards.

### Borders

Use `#2A3445` for most borders.

Do not use wine red as a default card border. Wine red should indicate:

- primary actions
- selected nav item
- selected filter
- critical status
- important AI highlight

### Wine Red

Use sparingly. Too much red makes the UI feel like a wireframe or game interface.

### Gold

Use for:

- AI-assisted insights
- drinking windows
- vintage / quality highlights
- premium indicators
- focus state on inputs

Gold should not be used as a general decoration.

---

# 5. Typography

## 5.1 Font Roles

### Playfair Display

Use only for "The Star":

- WineNotes logo
- wine names
- estate names
- large editorial titles when appropriate

Do not use Playfair for dense UI, forms, nav, or long AI prose.

### Geist

Use for the workspace:

- navigation
- forms
- buttons
- cards
- charts
- labels
- metrics
- body copy
- AI-generated explanation text

## 5.2 Language Rule

Use a controlled Japanese/English mix:

```text
Navigation and operations: Japanese
Analytical section names: English or Japanese, depending on clarity
Explanatory text: Japanese
Wine names / regions / producers: original language where useful
```

Examples:

- ナビ: `記録`, `AI解説`, `一覧`, `統計`, `設定`
- Analysis sections: `AI Verdict`, `Taste Structure`, `Profile Map`
- Body: Japanese

---

# 6. Layout & Spacing

Use a 4px baseline grid.

## Desktop

- 12-column grid.
- 16px gutters.
- Main page margin: 32px.
- Fixed sidebar: approximately 240px.
- Optional right insight panel: approximately 320px.
- Max content width: 1440px.

## Tablet

- 8-column grid.
- 16px gutters.
- Reduce hero layouts from 3 columns to 2 columns.

## Mobile

- 4-column grid.
- 16px margins.
- Use bottom navigation instead of desktop sidebar.
- Add safe-area and bottom padding so fixed nav never overlaps content.

## Spacing Intent

- Generous spacing around wine photos, titles, and AI Verdict.
- Compact spacing inside forms, metric cards, and data tables.
- Avoid both extremes: empty luxury landing pages and cramped admin dashboards.

---

# 7. Elevation & Depth

Depth is created through tonal layering and subtle glass effects, not heavy shadows.

## Levels

```text
Level 0: Canvas          #070A0F
Level 1: Surface         #121821
Level 2: Elevated        #1A2230
Level 3: Highest/Active  #202B38
```

## Glass Effects

Use only for:

- overlays
- modals
- floating mobile nav
- AI processing panels
- command-palette-like interactions

Recommended:

```css
background: rgba(26, 34, 48, 0.80);
backdrop-filter: blur(12px);
border: 1px solid #2A3445;
```

---

# 8. Shape System

- Standard UI elements: 8px radius.
- Large cards / label image frames: 16px radius.
- Chips and tags: full pill radius.
- Avoid overly rounded "mobile game" cards.

---

# 9. Component Rules

## 9.1 Buttons

### Primary

- Solid wine red.
- White/off-white text.
- No gradient.
- Used for key actions only:
  - `記録を追加`
  - `記録を保存`
  - `AI解説を生成`

### Secondary

- Ghost style.
- Neutral border.
- Off-white text.

### Danger

- Ghost or subtle red.
- Avoid large solid red unless destructive action is confirmed.

## 9.2 Input Fields

Inputs must be dark, never bright white.

```css
background: #070A0F;
border: 1px solid #2A3445;
color: #F4F1EA;
```

Focus:

```css
border-color: #C7A15A;
box-shadow: 0 0 0 3px rgba(199, 161, 90, 0.12);
```

Placeholders:

```css
color: #8E99AA;
```

## 9.3 Cards

Normal cards:

```css
background: #121821;
border: 1px solid #2A3445;
box-shadow: none;
```

Use red borders only for exceptional states.

## 9.4 Chips

Chips are compact, pill-shaped metadata.

Examples:

- `Pinot Noir`
- `Burgundy, France`
- `AI分析済み`
- `Best window: 2028–2036`
- `Elegant / Mineral / Red fruit`

Use muted backgrounds:

- wine red soft for selected or important profile chips
- gold soft for AI/drinking-window chips
- neutral surface for normal metadata

## 9.5 AI Insight Panel

AI panels should feel distinct but integrated.

Recommended visual pattern:

- subtle elevated surface
- small AI icon
- gold or wine-red accent
- concise title
- structured content
- no oversized decorative effects

## 9.6 Wine Image Frame

Use for label photos.

Rules:

- Preserve aspect ratio.
- Use dark frame and subtle border.
- Add missing-image fallback.
- Avoid cropping label text too aggressively.
- Use object-fit contain when the label itself is the subject.
- Use object-fit cover only for atmospheric background images.

---

# 10. Navigation

## Desktop Sidebar

Labels:

- `記録`
- `AI解説`
- `一覧`
- `統計`
- `設定`

Rules:

- Sidebar should feel stable and quiet.
- Active state should use subtle red accent.
- Avoid heavy red backgrounds.
- Icons should be 20px with consistent 1.5px stroke.
- Logo may use Playfair Display.

## Mobile Bottom Navigation

Rules:

- Floating or fixed dark glass style.
- Must not overlap content.
- Use safe-area padding.
- Active item uses wine red.
- Inactive items use muted gray.
- Content pages must include sufficient bottom padding.

---

# 11. Page Patterns

## 11.1 Wine Library / List

Purpose: Browse and recall wines visually.

Pattern:

- Page title: `ワイン一覧`
- Search bar
- Filter chips
- Primary CTA: `記録を追加`
- Responsive card grid
- Label image occupies roughly 60–70% of card height
- Text metadata is compact

Card content:

```text
Wine name
Producer

Country · Region · Grape
★ Rating    Price    AI分析済み
```

Prioritize image-led browsing over dense database display.

## 11.2 Wine Detail

Purpose: Show the user's tasting record.

Hero:

- large label image
- wine name
- producer
- vintage
- region
- grape
- tasting date
- key cards:
  - `総合評価`
  - `飲み頃`
  - `価格`

Sections:

- `基本情報`
- `外観`
- `香り`
- `味わい`
- `総評`

AI analysis should be linked but not mixed into every detail section.

## 11.3 AI Wine Analysis

Purpose: Present AI-generated wine intelligence.

Hero layout:

```text
Left:   wine label image
Center: wine identity and metadata
Right:  AI Verdict panel
```

AI Verdict should be prominent.

Insight chips:

- `Best window`
- `Style`
- `Pairing`
- `Confidence`

Analysis sections:

- `AI Verdict`
- `Taste Structure`
- `Profile Map`
- `テロワール`
- `生産者`
- `ヴィンテージ`
- `技術情報`
- `フードペアリング`
- `参考情報`

Avoid relying on a luxury background image as the main visual. The label photo and AI insight are the product.

## 11.4 Statistics Dashboard

Purpose: Explain the user's wine preference pattern.

KPI cards:

- `総テイスティング本数`
- `直近1ヶ月`
- `平均価格`
- `AI分析済み`

Insight panel:

- Title: `Your Wine Pattern`
- Explain recent preference trends in Japanese.
- Use AI/gold/wine-red accents sparingly.

Charts:

- monthly trend
- type ratio
- country distribution
- top regions
- price vs rating

Charts should be minimal and readable in dark mode.

## 11.5 Tasting Record Form

Purpose: Fast, clear wine note entry.

Recommended sections:

1. `写真・基本情報`
2. `外観`
3. `香り`
4. `味わい`
5. `総評・AI分析`

Use either:

- stepper with one active section at a time, or
- accordion with one expanded section

Do not show multiple unrelated steps as full active content.

Photo upload should be prominent.

Aroma chips:

- `赤系果実`
- `黒系果実`
- `花`
- `スパイス`
- `樽`
- `土`
- `ミネラル`

Taste sliders:

- acidity
- tannin
- body
- sweetness
- alcohol

Bottom action area:

- `キャンセル`
- `記録を保存`
- `AIで補完`

It must not be hidden behind mobile navigation.

---

# 12. Data Visualization

## Chart Style

- Dark card background.
- Thin, low-contrast gridlines.
- Muted axis labels.
- Red/gold only for highlights.
- Always include fallback text or labels for accessibility.

## Taste Structure Bars

Use horizontal bars for:

- acidity
- tannin
- body
- fruit
- oak
- minerality

Use gold for high structural components such as acidity/minerality when relevant, wine red for fruit or style highlights, and neutral for baseline components.

## Profile Map

Should be subtle and secondary. Avoid making it more visually dominant than AI Verdict or label image.

---

# 13. States

## Loading

Use skeletons with tonal surfaces.

## Empty

Empty states should be useful, not decorative.

Examples:

- no wines: encourage `記録を追加`
- no AI analysis: encourage `AI解説を生成`
- no image: show tasteful label placeholder
- no stats: explain that stats appear after enough records

## Error

Use restrained red, clear message, and recovery action.

---

# 14. Accessibility

- Maintain sufficient contrast.
- All interactive elements need visible focus states.
- Buttons need clear labels.
- Images need alt text.
- Forms need associated labels.
- Charts need text summaries where possible.
- Avoid communicating status by color alone.

---

# 15. Implementation Guardrails

Do:

- implement tokens first
- reuse components
- keep commits small and atomic
- preserve existing behavior
- make label images prominent
- make AI insights structured
- test desktop and mobile

Do not:

- overuse wine red borders
- make form inputs bright white
- turn daily screens into landing pages
- hardcode DRC or luxury-only examples into reusable UI
- hide important actions behind decorative layouts
- introduce major dependencies without need
- alter database schema unless explicitly required
