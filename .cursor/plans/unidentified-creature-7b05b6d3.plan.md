<!-- 7b05b6d3-38f0-47a7-94f0-c46ad26b3578 cea653ae-f65c-4496-8dbc-38f22fe730d3 -->
# Add UNIDENTIFIED Identification Mode

## Overview

Add support for marking detections as "UNIDENTIFIED" - a catch-all for living things that can't be identified beyond their taxonomic classification. Similar to ERROR mode but preserves existing taxonomy levels.

## Assumptions (can be changed later)

1. **Taxonomy preservation**: Preserve all existing taxonomy levels (class, order, family, genus) from bot detection, but clear species-level identification
2. **UI display**: UNIDENTIFIED appears separately in the taxonomy section (like ERROR), not in the hierarchical tree
3. **Export behavior**: Export preserves all taxonomy levels with scientificName="UNIDENTIFIED"
4. **Trigger text**: Both "UNIDENTIFIED" and "Unidentified creature" (case-insensitive) trigger the special action

## Implementation Steps

### 1. Update Detection Entity Type

- **File**: `src/stores/entities/detections.ts`
- Add `isUnidentified?: boolean` flag to `DetectionEntity` type (similar to `isError`)

### 2. Update Identify Dialog UI

- **File**: `src/features/species-identification/identify-dialog.tsx`
- Add special case for "UNIDENTIFIED" and "Unidentified creature" (case-insensitive)
- Show action button similar to ERROR mode (lines 159-168)
- Call `handleSelect('UNIDENTIFIED')` when selected

### 3. Update Detection Labeling Logic

- **File**: `src/stores/entities/detections.ts`
- In `labelDetections()` function, add special case for UNIDENTIFIED (similar to ERROR handling at line 56)
- When label is "UNIDENTIFIED":
- Set `isUnidentified: true`
- Preserve existing taxonomy (class, order, family, genus) from `existing?.taxon`
- Clear species-level identification
- Set `label: 'UNIDENTIFIED'`
- Set `scientificName: 'UNIDENTIFIED'` in taxon object

### 4. Update Taxonomy Tree Building

- **File**: `src/routes/5.night/night-view.tsx`
- In `buildTaxonomyTreeForNight()` function (line 215), skip UNIDENTIFIED items from taxonomy tree (similar to ERROR at line 234)
- Add special handling in `filterPatchesByTaxon()` (line 285) to filter by `isUnidentified` flag when selected

### 5. Update Taxonomy UI Display

- **File**: `src/features/left-panel/taxonomy-section.tsx` (or wherever taxonomy counts are displayed)
- Add "Unidentified" row/count similar to how ERROR is displayed
- Show count of detections with `isUnidentified: true` in the Identified bucket

### 6. Update Export Logic

- **File**: `src/features/export/darwin-csv.ts`
- In `buildDarwinRowObject()` function (line 266), handle UNIDENTIFIED:
- Preserve taxonomy levels (class, order, family, genus) from `detection?.taxon`
- Set `scientificName: 'UNIDENTIFIED'`
- Set `label: 'UNIDENTIFIED'`
- Set `species: ''` (empty)
- Keep other taxonomy fields from detection

### 7. Update JSON Persistence

- **File**: `src/features/folder-processing/files.writer.ts`
- In `buildUserIdentifiedJson()` function (line 148), add handling for UNIDENTIFIED:
- Preserve taxonomy fields (class, order, family, genus) when `isUnidentified` is true
- Set `label: 'UNIDENTIFIED'`
- Add `is_unidentified: true` flag to JSON shape

### 8. Update JSON Ingestion

- **File**: `src/features/ingest/ingest-night.ts`
- In `overlayNightUserDetections()` function (line 89), handle reading `is_unidentified` flag:
- Check for `is_unidentified === true` or label === "UNIDENTIFIED"
- Preserve taxonomy when rehydrating from JSON
- Set `isUnidentified: true` on detection entity

## Testing Considerations

- Verify UNIDENTIFIED appears in identify dialog when typing trigger text
- Verify taxonomy is preserved when marking as UNIDENTIFIED
- Verify UNIDENTIFIED appears separately in taxonomy panel (not in tree)
- Verify export includes preserved taxonomy with scientificName="UNIDENTIFIED"
- Verify JSON persistence/ingestion round-trip works correctly