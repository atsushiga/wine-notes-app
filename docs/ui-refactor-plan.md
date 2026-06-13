# WineNotes UI Refactor Audit

Date: 2026-06-13

## Repository shape

- Framework: Next.js App Router with React 19 and TypeScript.
- Package manager: npm (`package-lock.json`).
- Styling: Tailwind CSS v4 utilities plus global CSS variables in `src/app/globals.css`.
- Shared UI primitives already present:
  - `src/components/layout/AppShell.tsx`
  - `src/components/layout/NavigationFrame.tsx`
  - `src/components/bottom-nav.tsx`
  - `src/components/layout/ContentContainer.tsx`
  - `src/components/layout/PageHeader.tsx`
  - `src/components/ui/Card.tsx`
  - `src/components/ui/section-card.tsx`
  - `src/components/ui/field-row.tsx`
- Form control styling is centralized in `src/constants/styles.ts`.

## Main routes and owners

- Tasting record form:
  - Route: `src/app/page.tsx`
  - Client wrapper: `src/app/WineEntryClient.tsx`
  - Main form: `src/components/WineForm.tsx`
- AI explanation input:
  - Route: `src/app/ai-explainer/page.tsx`
  - Client: `src/app/ai-explainer/AiExplainerClient.tsx`
  - History: `src/app/ai-explainer/AiExplainerHistory.tsx`
- AI analysis result:
  - Route: `src/app/ai-explainer/result/page.tsx`
- Wine library:
  - Route: `src/app/tasting-notes/page.tsx`
  - Cards/list: `src/components/WineList.tsx`
- Wine detail:
  - Route: `src/app/wines/[id]/page.tsx`
  - Client wrapper: `src/app/wines/[id]/WineDetailClient.tsx`
  - Detail view: `src/components/WineDetailView.tsx`
- Statistics:
  - Route: `src/app/statistics/page.tsx`
  - Layout/charts: `src/components/dashboard/*`
- Settings:
  - Route: `src/app/settings/page.tsx`
  - Sections: `src/components/settings/*`

## Current implementation notes

- `DESIGN.md` has been replaced with the updated design system and should be treated as the visual source of truth.
- Current tokens are still legacy light/rose-first variables in `src/app/globals.css`; Phase 1 should move them to the new dark WineNotes workspace palette.
- Existing navigation is implemented by `BottomNav`, which also becomes a desktop sidebar through responsive classes. Phase 2 should split or clarify desktop sidebar and mobile bottom navigation behavior.
- Cards and section cards already route through shared components, so Phase 1 can improve a large surface area by updating primitives first.
- Wine library already uses image cards, but metadata density, image priority, filter chips, search, and accent colors need Phase 3 treatment.
- Wine detail already has image, core metadata, edit/delete, and AI generation actions; Phase 4 should reorganize hierarchy and separate user notes from AI.
- AI result page is large and self-contained; Phase 5 should preserve data flow while improving hero, verdict, chips, bars, and partial-data behavior.
- Dashboard uses `DashboardLayout`, `KPICards`, Recharts charts, and `RegionMap`; Phase 6 should add wine-specific insight framing and tune chart surfaces.
- `WineForm` is the highest-risk UI file. Phase 7 should keep existing submit/upload/AI behavior and only reorganize section visibility and action placement.

## Available checks

- `npm run lint`
- `npm run build`
- `npm run test:e2e`

There is no dedicated `typecheck` script in `package.json`.

## Baseline quality

- `npm run lint` passes with 26 existing warnings and no errors.
