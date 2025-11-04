## Morphospecies Index Feature Plan

### Context

- Goal: From Home, add a button to a new route that shows all morphospecies used across datasets. Clicking an item shows in which projects they appear.
- Persistence: As users save morphospecies (free-text identifications), update `nightSummariesStore` and write to disk so subsequent app loads can restore quickly.

### Morphospecies Definition

A morphospecies is a user-defined species-level identification (stored in `detection.morphospecies`) that:
- Requires higher taxonomic context (order, family, or genus) to be assigned
- Preserves the underlying scientific taxonomy hierarchy (kingdom, phylum, class, order, family, genus, scientificName, taxonRank)
- Is treated as a temporary, unaccepted concept that doesn't replace scientific taxonomic information
- Can be merged with higher taxonomic ranks (genus, family, order) while remaining preserved
- Is cleared when replaced with a full scientific species identification (genus + species)

**Detection criteria**: A detection is considered a morphospecies when `detection.morphospecies` is a non-empty string (regardless of `taxon` presence, as the scientific taxonomy is preserved separately).

### Open Questions

1. ~~Morphospecies definition~~: ✅ Defined above. Any detection with `morphospecies` field populated is a morphospecies.
2. Canonical key: should morphospecies be normalized case-insensitively (e.g. lowercase) and trimmed? Keep original casing for display?
3. Scope grouping: when viewing usage, show counts per project and allow drill-down to sites/deployments/nights?
4. Navigation: preferred path: `/morpho` for index, and maybe `/morpho/$key` for usage details?
5. Capacity: expected number of morphospecies—do we need pagination/search in the grid now?
6. Persistence filename/location: store under each night's `night_summary.json` (extend schema), or create a `night_morpho_summary.json`? Preference?

### Proposed Data Model Changes

- Extend `NightSummaryEntity` (in `src/stores/entities/night-summaries.ts`) with optional morpho fields:
  - `morphoCounts?: Record<string, number>` — per-night tally of morphospecies by normalized key
  - `morphoProjects?: Record<string, true>` — optional presence map by projectId (if needed for fast rollups)
  - Leave backwards-compatible; unrecognized fields are ignored.

Normalization helper:

- `normalizeMorphoKey(label: string): string` → `label.trim().toLowerCase()`

### Write Path (on user identification)

- In `labelDetections` (src/stores/entities/detections.ts), after updating detections:
  - Derive the subset of updated detections that are morphospecies (`morphospecies` field is non-empty string).
  - Schedule save per night (already exists); enhance `exportUserDetectionsForNight` to:
    - Compute per-night `morphoCounts` by iterating detections for that night where `morphospecies` is a non-empty string.
    - Merge with existing summary loaded in memory.
    - Persist updated `night_summary.json` including new fields.

### Read Path (on app load)

- `preloadNightSummariesFromIndexed` already reads `night_summary.json`.
- Update the parser to read optional `morphoCounts` and store in `nightSummariesStore`.

### Routes & UI

- New route: `/morpho` with a page component at `src/routes/morpho/index.tsx`.
  - Shows a grid of morphospecies derived by aggregating `nightSummariesStore` across nights: reduce all `morphoCounts` maps.
  - Each card: name, total count, and number of nights/projects (if easily available). Click navigates to `/morpho/$key`.
- New route: `/morpho/$key` with a details page showing usage locations:
  - List projects (and optionally sites/deployments/nights) where it appears, based on cross-join `nightSummaries`, `nightsStore` for hierarchy.

### Home Button

- Add a small button/link in `src/routes/0.home/index.tsx` header (near “Projects”) or in `HomeSummaryPanel` to navigate to `/morpho`.

### Components/Stores To Touch

- `src/stores/entities/night-summaries.ts` — extend type.
- `src/features/folder-processing/files.writer.ts` — compute and write morpho summary fields.
- `src/features/folder-processing/files.initialize.ts` — parse morpho fields when preloading.
- `src/router.tsx` — register new routes.
- `src/routes/0.home/index.tsx` (or `home-summary-panel.tsx`) — add navigation button.
- New files: `src/routes/morpho/index.tsx`, `src/routes/morpho/detail.tsx` (or `[key].tsx` style naming consistent with router).

### Checklist

- [ ] Confirm answers to open questions
- [ ] Update `NightSummaryEntity` type (backwards compatible)
- [ ] Update writer to persist `morphoCounts`
- [ ] Update initializer to load `morphoCounts`
- [ ] Add `/morpho` and `/morpho/$key` routes
- [ ] Add Home button to navigate to `/morpho`
- [ ] Implement morpho aggregation selector from `nightSummariesStore`
- [ ] Grid UI with search (optional) and totals
- [ ] Details UI listing projects (and optionally sites/deployments/nights)
- [ ] Test: identify morphospecies, verify summaries update and page reflects data
