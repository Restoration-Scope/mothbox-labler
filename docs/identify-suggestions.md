### Identify suggestions: how they are built and rendered

This documents how the Identify dialog composes and shows suggestion lists.

Relevant files:

- `src/routes/5.night/identify-dialog.tsx` (UI and render rules)
- `src/stores/species-lists.ts` (species list ingestion and fuzzy search)
- `src/components/species-picker.tsx` (project → species list selection)

### Data sources

- **Species (fuzzy search)**: Results from `searchSpecies({ speciesListId, query, limit })`.

  - Index is built per list with `fuzzysort.prepare` on a combined string: `scientificName | genus | family | order | vernacularName`.
  - Case-insensitive; `threshold: -10000`; default `limit: 20`.
  - Species CSVs must live under a `Species/` folder (case-insensitive); CSV/TSV headers are read case-insensitively. If `scientificName` is missing but `genus`/`family`/`order` exists, the highest available rank is used as the display name.

- **Recent**: Last 5 unique items identified by the user across all nights, taken from `detectionsStore` where `detectedBy === 'user'`. Shows text label and rank badges when taxonomy exists.

- **Free text commands**: When there is any query, the dialog offers commands to add the typed text as:

  - "Add morpho species: "<query>"" (and additional rank variants). All of these submit the same free-text label.

- **Actions**: Typing exactly `ERROR` shows an action to mark detection as error.

Note: Legacy plain-text suggestions have been removed.

### Morphospecies: concepts and behavior

A **morphospecies** is a user-defined species-level identification used when a precise scientific name is unknown. It's treated as a temporary, unaccepted concept that doesn't replace the underlying scientific taxonomy.

**Key principles:**

1. **Preserves scientific taxonomy**: When a morphospecies is created, the existing scientific taxonomy hierarchy (kingdom, phylum, class, order, family, genus, scientificName, taxonRank) is preserved. The morphospecies is stored separately in the `morphospecies` field and does not overwrite scientific taxonomic information.

2. **Requires taxonomic context**: A morphospecies can only be assigned when the detection already has higher taxonomic context (order, family, or genus). Without this context, the morphospecies assignment is skipped.

3. **Merging with higher ranks**: When adding higher taxonomic ranks (genus, family, order) to an existing morphospecies:
   - The morphospecies is preserved
   - The new taxonomic ranks are merged with existing ranks
   - The scientific taxonomy hierarchy is updated accordingly
   - The morphospecies remains as the species-level identifier

4. **Full species replacement**: When identifying with a complete species (both genus and species fields present), the morphospecies is cleared and replaced with the scientific identification.

5. **Name derivation**: The `name` field (used in exports) prioritizes:
   - `"genus morphospecies"` when both genus and morphospecies exist
   - `morphospecies` alone when no genus is present
   - Otherwise, the deepest taxonomic level identified

**Examples:**

- Auto-detection: `order: 'Diptera'` → User adds morphospecies `"Custom Morpho A"` → Result: `order: 'Diptera'` preserved, `morphospecies: 'Custom Morpho A'`
- Morphospecies exists → User adds `genus: 'Lispe'` → Result: `genus: 'Lispe'` merged, `morphospecies: 'Custom Morpho A'` preserved
- Morphospecies exists → User identifies full species `genus: 'Lispe', species: 'tentaculata'` → Result: morphospecies cleared, full scientific taxonomy applied

### Render order and conditions (current)

Within the dialog `CommandList`:

1. **Actions** (only when `query.trim().toUpperCase() === 'ERROR'`).
2. **Recent** (only when there is no query OR no species results).
3. **Species** (only when `speciesOptions.length > 0`).
4. **Free text commands** (only when `query` is non-empty).

Keyboard behavior:

- Pressing Enter submits free-text only when there are no species results for the current query.

### Requirements for Species results to appear

- A species list must be selected for the active project (via `SpeciesPicker`).
- The selected list must have been ingested from the opened folder (CSV/TSV under `Species/`).
- The query must fuzzy-match at least one combined string in the list.

### Debug checklist if Species results don’t show

1. **Selection**: Open the species picker and verify the list is selected for this project.
2. **Ingestion**: Re-open/restore the folder. Check that your CSV exists under `Species/` and appears in the picker (names come from the file name).
3. **Content**: Confirm the CSV contains a matching token (e.g., `scientificName` or `genus` includes your query). For genus-only rows, ingestion now falls back to genus as the display `scientificName`.
4. **Query**: Try different casings or a shorter prefix; fuzzy search is case-insensitive but the threshold may filter extremely distant matches.
5. **UI**: If you still only see “Add …” commands, it means `speciesOptions.length === 0` (no matches or no selected list). Use the steps above to isolate selection vs. data issues.

### Notes

- Rank badges: `RankLettersInline` shows small letters for available ranks among `order`/`family`/`genus`. A full `TaxonRankBadge` shows the taxon’s `taxonRank` on the right.
- The dialog clears its query when it opens.

### Species ingestion, indexing, and search (deeper)

1. Ingestion (`ingestSpeciesListsFromFiles`):

   - Scans indexed files for paths under `Species/` with `.csv` or `.tsv`.
   - Supports both direct `File` entries and directory handles (restored folders) via `handle.getFile()`.
   - Parses with PapaParse in header mode. Headers are treated case-insensitively.
   - Maps each row to `TaxonRecord`:
     - `scientificName` primary; if missing, falls back to highest of `genus` → `family` → `order`.
     - Keeps `taxonRank`, `kingdom` → `species`, `vernacularName`, and passthroughs.
   - Dedupes by `taxonID || scientificName` (lowercased).
   - Stores lists keyed by file name; invalidates per-list fuzzy index cache on update.

2. Indexing (`ensureSpeciesIndexForList`):

   - For the selected list, builds an array of `{ ref, search }`, with `search = fuzzysort.prepare(combinedString)`.
   - `combinedString` includes `scientificName`, `genus`, `family`, `order`, `vernacularName` when present.

3. Search (`searchSpecies`):

   - Returns top matches for `query.trim()` using `fuzzysort.go` with the prepared `search` key.
   - Tunables: `limit` (default 20), `threshold` (default `-10000`). Lowering the threshold will include even weaker matches; raising it will be stricter.

4. Rendering in the dialog:
   - Species results show with `scientificName` and a right-aligned `taxonRank` badge, plus small inline badges for available higher ranks.
   - Selecting a species returns both the label (scientific name) and the full `TaxonRecord` to the caller.
