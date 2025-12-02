# Staff Engineer Code Review: Data Flow Architecture

## Executive Summary

**Overall Assessment: 🟡 Yellow - Significant Duplication & Architectural Drift**

The codebase shows signs of organic growth with multiple "single sources of truth" that are actually duplicates. While the 4-layer separation (Ingest → Identify → Persist → Export) is conceptually sound, the implementation has drifted with redundant code paths and competing abstractions.

---

## 🚨 Critical Issues

### 1. **DUPLICATE FILES: `identify.ts` exists in TWO locations**

```
src/features/identification/identify.ts          ← OLD LOCATION
src/features/data-flow/2.identify/identify.ts    ← NEW LOCATION (data-flow reorg)
```

These files are **nearly identical** (only 1 line difference in imports). Both claim to be the "single source of truth" for identification logic.

**Impact:**

- Confusion about which to use
- Risk of divergence over time
- Maintenance burden

**Fix:** Delete `src/features/identification/identify.ts` - it appears to be a leftover from before the `data-flow/` reorganization.

---

### 2. **TRIPLICATE LOGIC: `handleTaxonIdentification` pattern duplicated 3x**

The complex taxon identification logic (merging, morphospecies handling, rank changes) is implemented in THREE places:

| Location                                        | Function                                       |
| ----------------------------------------------- | ---------------------------------------------- |
| `src/features/data-flow/2.identify/identify.ts` | `handleTaxonIdentification()`                  |
| `src/features/identification/identify.ts`       | `handleTaxonIdentification()` (duplicate file) |
| `src/models/detection-shapes.ts`                | `updateDetectionWithTaxon()`                   |

**The logic is nearly identical:**

```typescript
// Pattern repeated 3 times:
if (isFullSpecies) {
  nextTaxon = normalizeSpeciesField(taxon)
  nextMorphospecies = undefined
} else if (isRankChanged) {
  nextTaxon = mergeTaxonRanks({ existing: existingTaxon, newTaxon: taxon })
  if (newRank === 'species') nextTaxon = normalizeSpeciesField(nextTaxon)
  nextMorphospecies = undefined
} else if (isHigherRank && detection?.morphospecies) {
  // ... 50+ lines of identical logic
}
```

**Impact:**

- Bug fixes must be applied in 3 places
- Subtle divergence risk (one already has different import)
- ~150 lines of duplicated code

**Fix:**

- `identify.ts` should call `updateDetectionWithTaxon()` from `detection-shapes.ts`
- OR `updateDetectionWithTaxon()` should call `identifyDetection()`
- Choose ONE as the source of truth

---

### 3. **DUPLICATE HELPER: `computeFinalLabel()` exists 3x**

```
src/features/data-flow/2.identify/identify.ts    line 254
src/features/identification/identify.ts          line 254
src/models/detection-shapes.ts                   line 391
```

All three are identical implementations.

**Fix:** Extract to `src/models/taxonomy/label.ts` or similar and import everywhere.

---

### 4. **DUPLICATE CHECK: `hasTaxon` pattern repeated 6x**

```typescript
const hasTaxon = !!taxon && (!!taxon.taxonRank || !!taxon.genus || !!taxon.family || !!taxon.order || !!taxon.species)
```

Found in:

- `src/features/data-flow/2.identify/identify.ts` (2x)
- `src/features/identification/identify.ts` (2x)
- `src/models/detection-shapes.ts` (1x)
- `src/stores/entities/detections.ts` (1x)

**Fix:** Extract to `src/models/taxonomy/validate.ts`:

```typescript
export function hasTaxonFields(taxon: TaxonRecord | undefined): boolean {
  return !!taxon && (!!taxon.taxonRank || !!taxon.genus || !!taxon.family || !!taxon.order || !!taxon.species)
}
```

---

## 🟡 Architectural Concerns

### 5. **Competing Abstraction Levels for Identification**

There are TWO APIs for identification that don't call each other:

**API 1: Store-level (currently used by UI)**

```typescript
// src/stores/entities/detections.ts
labelDetections({ detectionIds, label?, taxon? })
  → updateDetectionWithTaxon()  // from detection-shapes.ts
  → updateDetectionAsMorphospecies()
  → updateDetectionAsError()
```

**API 2: Pure function (not used)**

```typescript
// src/features/data-flow/2.identify/identify.ts
identifyDetection({ detection, input, context })
  → handleTaxonIdentification()  // duplicates updateDetectionWithTaxon logic!
  → handleMorphospeciesIdentification()
  → handleErrorIdentification()
```

**Problem:**

- `labelDetections()` uses functions from `detection-shapes.ts`
- `identifyDetection()` reimplements the same logic inline
- Neither calls the other

**Recommendation:**

```
Option A: Make labelDetections() call identifyDetection()
          Delete updateDetectionWithTaxon/AsMorphospecies/AsError from detection-shapes.ts

Option B: Make identifyDetection() call the detection-shapes.ts functions
          (Simpler refactor, keeps model functions as primitives)
```

---

### 6. **Store File Has Business Logic**

`src/stores/entities/detections.ts` contains:

- Store definition ✅
- Computed selectors ✅
- **Complex business logic** ❌ (`labelDetections`, `acceptDetections`, `resetDetections`)

**Problem:** Store files should be thin wrappers. Business logic should live in feature modules.

**Recommendation:** Move to `src/features/data-flow/2.identify/identification-actions.ts`:

```typescript
export function labelDetections(...)
export function acceptDetections(...)
export function resetDetections(...)
```

Keep in `detections.ts`:

```typescript
export const detectionsStore = atom<...>({})
export function detectionStoreById(id: string)
export function isUserIdentified(detection)
```

---

### 7. **Inconsistent Function Naming**

| Pattern    | Examples                                                                     |
| ---------- | ---------------------------------------------------------------------------- |
| `buildX`   | `buildDetectionFromBotShape`, `buildNightSummary`, `buildMorphospeciesTaxon` |
| `updateX`  | `updateDetectionWithTaxon`, `updateDetectionAsError`                         |
| `extractX` | `extractTaxonomyFromShape`, `extractMorphospeciesFromShape`                  |
| `handleX`  | `handleTaxonIdentification`, `handleErrorIdentification`                     |

**Issue:** `buildDetectionFromBotShape` and `updateDetectionWithTaxon` do similar things (create a new detection entity) but have different prefixes.

**Recommendation:** Standardize:

- `buildX` = create new entity from external data (JSON shapes)
- `applyX` = modify existing entity with new data
- `extractX` = pull data out of an entity

---

## 🟢 What's Working Well

### ✅ Good Separation of Concerns

The 4-layer model is sound:

```
1.ingest/   → File parsing, entity creation
2.identify/ → User identification logic
3.persist/  → Writing to filesystem
4.export/   → CSV/ZIP generation
```

### ✅ Model Layer is Clean

`src/models/taxonomy/` is well-organized:

- `types.ts` - Type definitions
- `extract.ts` - Extraction functions
- `merge.ts` - Merge/combine functions
- `morphospecies.ts` - Morphospecies-specific logic
- `keys.ts` - Key generation
- `normalize.ts` - Normalization utilities

### ✅ Persistence is Properly Decoupled

The debounced save pattern is good:

```
scheduleSaveForNight() → debounce → exportUserDetectionsForNight()
```

### ✅ Export Uses Shared Utilities

Both export functions properly use shared taxonomy extraction:

```typescript
extractTaxonomyFieldsFromDetection() // Used by darwin-csv.ts
extractTaxonMetadataFromDetection() // Used by darwin-csv.ts
```

---

## 📋 Recommended Refactoring Plan

### Phase 1: Delete Duplicates (Low Risk)

1. Delete `src/features/identification/identify.ts` (duplicate of data-flow version)
2. Extract `computeFinalLabel()` to shared location
3. Extract `hasTaxonFields()` to shared location

### Phase 2: Consolidate Identification Logic (Medium Risk)

1. Choose ONE source of truth for identification:
   - **Option A:** Keep `identify.ts`, have it call `detection-shapes.ts` functions
   - **Option B:** Delete `identify.ts`, use `detection-shapes.ts` directly
2. Update `labelDetections()` to use chosen API

### Phase 3: Move Business Logic Out of Store (Medium Risk)

1. Move `labelDetections`, `acceptDetections`, `resetDetections` to feature module
2. Keep store file thin

### Phase 4: Standardize Naming (Low Risk)

1. Rename functions for consistency
2. Update all call sites

---

## Metrics

| Metric                          | Current                 | After Refactor |
| ------------------------------- | ----------------------- | -------------- |
| Duplicate files                 | 1                       | 0              |
| Duplicate functions             | 3 (`computeFinalLabel`) | 0              |
| Duplicate patterns              | 6 (`hasTaxon` check)    | 0              |
| Lines of duplicated logic       | ~200                    | 0              |
| "Single source of truth" claims | 3                       | 1              |

---

## Questions for Product/Team

1. ~~Is `identify.ts` in `features/identification/` ever imported?~~ **CONFIRMED DEAD CODE** - No imports found
2. Should `acceptDetections()` really search the species list, or should it just mark as accepted?
3. ~~Is the `isMorpho` field still used anywhere?~~ **STILL USED** - Used in UI for display (taxonomy-row, patch-item, etc.) but always set to `undefined` in identification logic. Consider removing from `DetectionEntity` and deriving from `!!detection.morphospecies` at render time.

---

## Immediate Actions (Can Do Now)

```bash
# 1. Delete the duplicate file (confirmed no imports)
rm src/features/identification/identify.ts
rmdir src/features/identification  # if empty

# 2. The data-flow version is the canonical one
# src/features/data-flow/2.identify/identify.ts
```
