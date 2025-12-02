# Data Ingestion, Identification, and Export Flows

## Overview

This document maps all data ingestion points, identification handling, and export flows in the mothbox-labeler application.

---

## 1. DATA INGESTION

### 1.1 Bot Detection JSON Files

**Entry Point:** `src/features/data-flow/1.ingest/ingest.ts`

**Flow:**
1. **File Discovery** → `singlePassIngest()` in `src/features/data-flow/1.ingest/files.single-pass.ts`
   - Validates folder structure
   - Indexes all files
   - Calls `ingestFilesToStores()` with `parseDetectionsForNightId: null` (no parsing at app load)

2. **File Classification** → `ingestFilesToStores()` in `src/features/data-flow/1.ingest/ingest.ts`
   - Uses `parsePathParts()` from `src/features/data-flow/1.ingest/ingest-paths.ts` to classify files:
     - `isBotJson`: `*_botdetection.json` files
     - `isUserJson`: `*_identified.json` files  
     - `isPhotoJpg`: `.jpg` photo files
     - `isPatch`: patch image files in `patches/` folder
   - Links bot detection JSON files to photos via `photo.botDetectionFile`
   - Links user detection JSON files to photos via `photo.userDetectionFile`

3. **Per-Night Parsing** → `parseNightBotDetections()` in `src/features/data-flow/1.ingest/ingest-night.ts`
   - Triggered when navigating to a night view
   - Called from `useNightIngest()` hook in `src/routes/5.night/use-night-ingest.ts`
   - For each photo with `botDetectionFile`:
     - Parses JSON via `parseBotDetectionJsonSafely()` in `src/features/data-flow/1.ingest/ingest-json.ts`
     - Extracts shapes array from `BotDetectionJson` type
     - For each shape:
       - Extracts patch filename from `shape.patch_path`
       - Finds/hydrates patch image file
       - Creates `PatchEntity` in `patchesStore`
       - Creates `DetectionEntity` via `buildDetectionFromBotShape()` in `src/models/detection-shapes.ts`
       - Sets `detectedBy: 'auto'` by default

**Key Functions:**
- ```11:132:src/features/data-flow/1.ingest/ingest.ts
  export async function ingestFilesToStores(params: {
    files: IndexedFile[]
    parseDetectionsForNightId?: string | null
    patchMap?: Record<string, IndexedFile>
  })
  ```
- ```11:79:src/features/data-flow/1.ingest/ingest-night.ts
  export async function parseNightBotDetections(params: {
    photos: Record<string, PhotoEntity>
    files: IndexedFile[]
    patchMap?: Record<string, IndexedFile>
    parseDetectionsForNightId?: string | null
    patches: Record<string, PatchEntity>
    detections: Record<string, DetectionEntity>
  })
  ```
- ```47:56:src/features/data-flow/1.ingest/ingest-json.ts
  export async function parseBotDetectionJsonSafely(params: { file: IndexedFile }): Promise<BotDetectionJson | null>
  ```
- ```51:77:src/models/detection-shapes.ts
  export function buildDetectionFromBotShape(params: { shape: any; existingDetection: DetectionEntity })
  ```

### 1.2 User Detection JSON Files (Saved Progress)

**Entry Point:** `overlayNightUserDetections()` in `src/features/data-flow/1.ingest/ingest-night.ts`

**Flow:**
1. After parsing bot detections, overlays user-saved identifications
2. For each photo with `userDetectionFile`:
   - Parses JSON via `parseUserDetectionJsonSafely()` in `src/features/data-flow/1.ingest/ingest-json.ts`
   - Extracts shapes array
   - For each shape:
     - Creates/updates `DetectionEntity` via `buildDetectionFromIdentifiedJsonShape()` in `src/models/detection-shapes.ts`
     - Sets `detectedBy: 'user'`
     - Extracts morphospecies if present
     - Preserves `identifiedAt` timestamp

**Key Functions:**
- ```81:105:src/features/data-flow/1.ingest/ingest-night.ts
  export async function overlayNightUserDetections(params: {
    photos: Record<string, PhotoEntity>
    parseDetectionsForNightId?: string | null
    detections: Record<string, DetectionEntity>
  })
  ```
- ```84:117:src/models/detection-shapes.ts
  export function buildDetectionFromIdentifiedJsonShape(params: { shape: any; photo: PhotoEntity; existingDetection?: DetectionEntity })
  ```

### 1.3 Species Lists (CSV Files)

**Entry Point:** `ingestSpeciesListsFromFiles()` in `src/features/data-flow/1.ingest/species.ingest.ts`

**Flow:**
1. Scans files for CSV/TSV files in `/species/` folder
2. Parses CSV rows using `csvToObjects()` from `src/utils/csv.ts`
3. Maps rows to `TaxonRecord[]` via `mapRowToTaxonRecords()` in `src/models/taxonomy/csv-parser.ts`
4. Deduplicates by `stableTaxonKey()` from `src/models/taxonomy/keys.ts`
5. Stores in `speciesListsStore` (from `src/features/data-flow/2.identify/species-list.store.ts`)
6. Invalidates search index for the list

**Key Functions:**
- ```11:63:src/features/data-flow/1.ingest/species.ingest.ts
  export async function ingestSpeciesListsFromFiles(params: { files: IndexedFile[] })
  ```

### 1.4 Morphospecies (Local Storage)

**Storage:** Morphospecies are stored as part of `DetectionEntity.morphospecies` field

**Ingestion:**
- Loaded from user detection JSON files (see 1.2)
- Extracted via `extractMorphospeciesFromShape()` in `src/models/taxonomy/morphospecies.ts`
- Also persisted in `night_summary.json` files (see 3.2)

**Key Functions:**
- ```62:83:src/models/taxonomy/morphospecies.ts
  export function extractMorphospeciesFromShape(params: {
    shape: any
    taxonomy: ExtractedTaxonomy
    taxon: { scientificName?: string; species?: string } | undefined
    isError: boolean
  }): string | undefined
  ```

---

## 2. IDENTIFICATION ACTIONS

### 2.1 Identify Dialog Flow

**Entry Point:** `IdentifyDialog` component in `src/features/data-flow/2.identify/identify-dialog.tsx`

**Flow:**
1. User opens dialog (hotkey `d` or button click)
2. Dialog shows:
   - Recent identifications (from `detectionsStore` where `detectedBy === 'user'`)
   - Morphospecies suggestions (from detections with `morphospecies` field)
   - Species search results (from selected species list)
   - Free-text input options (morphospecies, species, genus, family, order, etc.)
3. User selects/enters identification:
   - **Taxon selection:** Calls `handleSelectTaxon(taxon)` → `onSubmit(label, taxon)`
   - **Free text:** Calls `handleSubmitFreeText()` → `onSubmit(label)` (morphospecies)
   - **ERROR:** Calls `handleSelect('ERROR')` → `onSubmit('ERROR')`
4. Dialog closes, calls parent's `onSubmit` callback

**Key Functions:**
- ```29:398:src/features/data-flow/2.identify/identify-dialog.tsx
  export function IdentifyDialog(props: IdentifyDialogProps)
  ```
- ```109:146:src/features/data-flow/2.identify/identify-dialog.tsx
  function handleSelectTaxon(t: TaxonRecord)
  function handleSubmitFreeText()
  ```

### 2.2 Identification Processing

**Entry Point:** `labelDetections()` in `src/stores/entities/detections.ts`

**Flow:**
1. Receives `detectionIds[]`, optional `label`, optional `taxon`
2. Determines identification type:
   - **Error:** `label === 'ERROR'` → `updateDetectionAsError()`
   - **Taxon:** `taxon` provided → `updateDetectionWithTaxon()`
   - **Morphospecies:** free text only → `updateDetectionAsMorphospecies()`
3. Updates `detectionsStore` with new entities
4. Updates night summaries in memory
5. Schedules save via `scheduleSaveForNight()`

**Key Functions:**
- ```63:109:src/stores/entities/detections.ts
  export function labelDetections(params: { detectionIds: string[]; label?: string; taxon?: TaxonRecord })
  ```
- ```196:291:src/models/detection-shapes.ts
  export function updateDetectionWithTaxon(params: UpdateDetectionWithTaxonParams): DetectionEntity
  ```
- ```305:335:src/models/detection-shapes.ts
  export function updateDetectionAsMorphospecies(params: UpdateDetectionAsMorphospeciesParams): DetectionEntity | null
  ```
- ```347:364:src/models/detection-shapes.ts
  export function updateDetectionAsError(params: UpdateDetectionAsErrorParams): DetectionEntity
  ```

### 2.3 Accept Action

**Entry Point:** `acceptDetections()` in `src/stores/entities/detections.ts`

**Flow:**
1. Validates detections have `order` field
2. Groups by `(speciesListId, order)` for batch processing
3. Searches species list for order taxon via `searchSpecies()`
4. Calls `labelDetections()` with order taxon (preserves existing taxonomy, marks as user-identified)

**Key Functions:**
- ```115:177:src/stores/entities/detections.ts
  export function acceptDetections(params: { detectionIds: string[] })
  ```

### 2.4 Centralized Identification Logic

**Entry Point:** `identifyDetection()` in `src/features/data-flow/2.identify/identify.ts`

**Note:** This is the centralized identification logic, but currently `labelDetections()` uses the model functions directly. The `identify.ts` functions provide an alternative API.

**Key Functions:**
- ```44:68:src/features/data-flow/2.identify/identify.ts
  export function identifyDetection(params: {
    detection: DetectionEntity
    input: IdentificationInput
    context?: IdentificationContext
  }): IdentificationResult
  ```
- ```271:302:src/features/data-flow/2.identify/identify.ts
  export function identifyDetections(params: {
    detections: Record<string, DetectionEntity>
    detectionIds: string[]
    input: IdentificationInput
    context?: IdentificationContext
  })
  ```

---

## 3. DATA PERSISTENCE

### 3.1 User Detection Persistence

**Entry Point:** `scheduleSaveUserDetections()` in `src/features/data-flow/3.persist/files.writer.ts`

**Flow:**
1. Triggered via `scheduleSaveForNight()` after identification actions
2. Debounced (400ms default delay)
3. `exportUserDetectionsForNight()`:
   - Groups user detections (`detectedBy === 'user'`) by photo
   - For each photo in the night:
     - Builds `_identified.json` file via `buildUserIdentifiedJson()`
     - Uses `buildIdentifiedJsonShapeFromDetection()` to convert `DetectionEntity` → JSON shape
     - Writes to `{nightDiskPath}/{photoBase}_identified.json`
   - Updates `night_summary.json` with current summary

**Key Functions:**
- ```24:39:src/features/data-flow/3.persist/files.writer.ts
  export function scheduleSaveUserDetections(params: { nightId: string; delayMs?: number })
  ```
- ```41:109:src/features/data-flow/3.persist/files.writer.ts
  export async function exportUserDetectionsForNight(params: { nightId: string })
  ```
- ```133:140:src/features/data-flow/3.persist/files.writer.ts
  function buildUserIdentifiedJson(params: { baseName: string; detections: DetectionEntity[] })
  ```
- ```28:44:src/models/detection-shapes.ts
  export function buildIdentifiedJsonShapeFromDetection(params: { detection: DetectionEntity; identifierHuman?: string })
  ```

### 3.2 Night Summary Persistence

**Storage:** `night_summary.json` files in each night folder

**Content:** Summary statistics, taxonomy counts, morphospecies counts

**Key Functions:**
- ```97:108:src/features/data-flow/3.persist/files.writer.ts
  // Update + persist night summary
  const summary = buildNightSummary({ nightId, detections: detectionsForNight })
  ```

---

## 4. DATA EXPORT

### 4.1 Darwin Core CSV Export

**Entry Point:** `exportNightDarwinCSV()` in `src/features/data-flow/4.export/darwin-csv.ts`

**Flow:**
1. Generates CSV string via `generateNightDarwinCSVString()`
2. For each detection in the night:
   - Builds row via `buildDarwinShapeFromDetection()`
   - Extracts taxonomy fields via `extractTaxonomyFieldsFromDetection()`
   - Extracts metadata via `extractTaxonMetadataFromDetection()`
   - Handles morphospecies vs. scientific species separation
   - Includes event date/time from photo filename
3. Converts to CSV via `objectsToCSV()` from `src/utils/csv.ts`
4. Writes to `{nightDiskPath}/{dataset}_{deployment}_{night}_exported-{date}.csv`

**Key Functions:**
- ```63:87:src/features/data-flow/4.export/darwin-csv.ts
  export async function exportNightDarwinCSV(params: { nightId: string }): Promise<boolean>
  ```
- ```192:221:src/features/data-flow/4.export/darwin-csv.ts
  export async function generateNightDarwinCSVString(params: { nightId: string }): Promise<{ csv: string; nightDiskPath: string } | null>
  ```
- ```259:348:src/features/data-flow/4.export/darwin-csv.ts
  export function buildDarwinShapeFromDetection(params: {
    detection: DetectionEntity
    patch?: PatchEntity
    photo?: PhotoEntity
    nightId: string
    nightDiskPath: string
  }): DarwinRow
  ```

### 4.2 Restoration Scope Summary Export

**Entry Point:** `exportNightSummaryRS()` in `src/features/data-flow/4.export/rs-summary.ts`

**Flow:**
1. Generates Darwin CSV (same as 4.1)
2. Collects unique identified detections by species key
3. For each unique species:
   - Extracts patch image file
   - Adds to ZIP as `images/{patchId}__{scientificName}.jpg`
4. Creates ZIP with:
   - `darwin_export.csv`
   - `images/{...}.jpg` files
5. Writes to `{nightDiskPath}/rs_summary.zip`

**Key Functions:**
- ```12:62:src/features/data-flow/4.export/rs-summary.ts
  export async function exportNightSummaryRS(params: { nightId: string })
  ```

---

## 5. DATA FLOW SUMMARY

### Ingestion Flow
```
Filesystem → singlePassIngest() → ingestFilesToStores() 
  → parseNightBotDetections() → buildDetectionFromBotShape() 
  → detectionsStore (detectedBy: 'auto')
  
User JSON → overlayNightUserDetections() 
  → buildDetectionFromIdentifiedJsonShape() 
  → detectionsStore (detectedBy: 'user')
```

### Identification Flow
```
User Action → IdentifyDialog → labelDetections() 
  → updateDetectionWithTaxon/updateDetectionAsMorphospecies/updateDetectionAsError 
  → detectionsStore.set() 
  → scheduleSaveForNight() 
  → exportUserDetectionsForNight() 
  → {photoBase}_identified.json
```

### Export Flow
```
User Action → exportNightDarwinCSV() 
  → generateNightDarwinCSVString() 
  → buildDarwinShapeFromDetection() 
  → CSV file
  
User Action → exportNightSummaryRS() 
  → generateNightDarwinCSVString() + patch images 
  → ZIP file
```

---

## 6. KEY STORES

- **`detectionsStore`**: `src/stores/entities/detections.ts` - All detection entities
- **`photosStore`**: `src/stores/entities/photos.ts` - Photo entities with file references
- **`patchesStore`**: `src/stores/entities/5.patches.ts` - Patch image entities
- **`speciesListsStore`**: `src/features/data-flow/2.identify/species-list.store.ts` - Ingested species lists
- **`nightSummariesStore`**: `src/stores/entities/night-summaries.ts` - Night-level summaries

---

## 7. KEY MODEL FUNCTIONS

**Detection Building:**
- `buildDetectionFromBotShape()` - Creates detection from bot JSON shape
- `buildDetectionFromIdentifiedJsonShape()` - Creates detection from user JSON shape
- `buildIdentifiedJsonShapeFromDetection()` - Converts detection to JSON shape for export

**Detection Updates:**
- `updateDetectionWithTaxon()` - Updates with taxon (handles merging, morphospecies)
- `updateDetectionAsMorphospecies()` - Sets morphospecies label
- `updateDetectionAsError()` - Marks as error

**Taxonomy Extraction:**
- `extractTaxonomyFromShape()` - Extracts taxonomy from JSON shape
- `extractTaxonomyFieldsFromDetection()` - Extracts taxonomy fields for export
- `extractMorphospeciesFromShape()` - Extracts morphospecies from shape


