## Plan: Species Lists, Fuzzy Identify, and Darwin Core-ready labeling

Goals

- Force user to select a Species list per project (persist across sessions).
- Ingest Species lists from root `Species/` folder (CSV/TSV; auto-detect delimiter).
- Provide fast fuzzy search suggestions (fuzzysort) across ranks and vernacular names.
- When identifying, store structured taxonomy on detections (Darwin Core-aligned) and a convenient `label`.
- Show a small badge in `nav` with the currently selected Species list for the active project.

Assumptions

- `Species/` lives at the root (alongside project folders) and can contain multiple list files.
- Optional `metadata.json` in a project folder may specify a preferred species list filename; we will use it to preselect but still require user confirmation.
- Example columns follow `examples/species-example.csv`; we must be resilient to CSV/TSV and partial columns.

Phases

1. Types and Stores

   - Add `TaxonRecord` type with Darwin Core fields commonly used: `taxonID?`, `scientificName`, `taxonRank`, `kingdom`, `phylum`, `class`, `order`, `family`, `genus`, `species`, `vernacularName?`, plus passthrough keys from the file (`taxonKey`, `acceptedTaxonKey`, `acceptedScientificName`, etc.).
   - Add `SpeciesList` type: `{ id: string; name: string; sourcePath: string; recordCount: number; records: TaxonRecord[] }`.
   - Create `speciesListsStore: Record<string, SpeciesList>` and `projectSpeciesSelectionStore: Record<projectId, speciesListId>` with IDB persistence.
   - Keep an in-memory fuzzy index cache per list (not persisted).

2. Ingestion

   - Implement `ingestSpeciesListsFromFiles({ files })`:
     - Find root `Species/*.csv|*.tsv` (case-insensitive), parse via Papa with header mode and delimiter auto-detect.
     - Map rows into `TaxonRecord`, tolerating missing columns.
     - Dedupe by `taxonKey || scientificName`.
     - Store into `speciesListsStore` with counts.
   - Detect per-project `metadata.json` and read `speciesListFileName` if present to suggest a default, but do not auto-select; user must confirm.
   - Call ingestion from `openDirectory` and `tryRestoreFromSavedDirectory`.

3. Selection UI (Nav)

   - In `nav.tsx`, when inside a project, show a small badge: `Species: <list name>`.
   - Clicking the badge opens a lightweight picker (dialog or dropdown) listing available species lists.
   - If no selection exists for the active project, auto-open the picker once (and keep working even if user closes it).

4. Fuzzy Matching

   - Add `fuzzysort` and build prepared indexes per selected list.
   - Search keys and weights (tunable): `scientificName` (3x), `genus` (2x), `family` (1.5x), `order` (1x), `vernacularName` (1x).
   - Normalize inputs (lowercase, trim, collapse spaces; diacritics as supported by fuzzysort).
   - Expose `searchSpecies({ listId, query, limit })`.

5. Identify Integration

   - Extend `DetectionEntity` with `taxon?: TaxonRecord` (and keep `label?: string`).
   - Update `labelDetections` to accept `{ detectionIds, taxon?: TaxonRecord, label?: string }`:
     - If `taxon` provided, set `detection.taxon = taxon` and `label = taxon.scientificName` (or chosen-rank name in future).
     - If only `label`, set text label and leave `taxon` undefined.
     - Add a comment: when a user creates a custom label, we only set species-level text for now (future enhancement to structure user-created taxa).
   - Add a `useSpeciesSuggestions({ projectId, query })` hook that pulls the selected list and runs fuzzy search.
   - Update `Night` to provide structured suggestions to `IdentifyDialog` and pass selected `TaxonRecord` back on submit.
   - Update `IdentifyDialog` UI to show rank chips and vernacular names; keep the `Use "query"` free-text command option.

6. Accept Behavior

   - Keep `acceptDetections` in code but add a TODO comment noting it may be deprecated (per discussion). Do not remove yet.

7. Persistence & Performance

   - Persist selection per `projectId` in IDB. Key by `projectId`; store the chosen species list id and source path; optionally add file signature (size + lastModified) for invalidation later.
   - Persist parsed lists (raw records) optionally in IDB later if startup cost becomes noticeable; for now, re-parse on folder open/restore. Rebuild fuzzy index in memory only.

8. Export (stub)
   - Create `features/export/export-dwc.ts` (stub) that maps detections with `taxon` to Darwin Core CSV rows; wire later.

File Changes (high-level)

- Add: `src/stores/species-lists.ts` (types, stores, ingestion, search helpers)
- Edit: `src/features/folder-processing/files.service.ts` (call ingestion)
- Edit: `src/components/nav.tsx` (badge + picker trigger)
- Add: `src/components/species-picker.tsx` (small dialog/dropdown)
- Edit: `src/routes/5.night/index.tsx` (wire suggestions + submit taxon)
- Edit: `src/routes/5.night/identify-dialog.tsx` (render structured suggestions)
- Edit: `src/stores/entities/detections.ts` (extend type + `labelDetections`)
- Add dep: `fuzzysort`

Validation

- Manual: Open a directory with `Species/` and multiple lists → forced selection prompt appears; badge updates.
- Identify: Typing yields fuzzy results; selecting saves `taxon` and `label`; free-text still works.
- Night metrics unchanged; Accept remains but noted for review.

Open Questions (tracked)

- CSV header variants: we’ll implement header detection using the example; capture unknown columns for later mapping.
- If lists are huge (>>100k), we may need chunked parsing or cache.
