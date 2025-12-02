# Complete Data Flow Diagram

## Visual Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    FILESYSTEM                                                │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐ │
│  │ *_botdetection   │  │ *_identified     │  │ patches/*.jpg    │  │ species/*.csv        │ │
│  │     .json        │  │     .json        │  │                  │  │                      │ │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────┘ │
└───────────┼─────────────────────┼─────────────────────┼──────────────────────┼─────────────┘
            │                     │                     │                      │
            ▼                     ▼                     ▼                      ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 1. INGEST LAYER                                               │
│                                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                           files.single-pass.ts                                          │  │
│  │                                                                                         │  │
│  │   singlePassIngest()                                                                    │  │
│  │       │                                                                                 │  │
│  │       ├── validateProjectRootSelection()  ─── files.validation.ts                       │  │
│  │       ├── applyIndexedFilesState()        ─── files.initialize.ts                       │  │
│  │       └── ingestFilesToStores()           ─── ingest.ts                                 │  │
│  │                                                                                         │  │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                           │                                                   │
│                                           ▼                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                               ingest.ts                                                 │  │
│  │                                                                                         │  │
│  │   ingestFilesToStores({ files, parseDetectionsForNightId, patchMap })                   │  │
│  │       │                                                                                 │  │
│  │       ├── parsePathParts()                ─── ingest-paths.ts                           │  │
│  │       │       │                                                                         │  │
│  │       │       └── Returns: { project, site, deployment, night,                          │  │
│  │       │                      isPatch, isPhotoJpg, isBotJson, isUserJson }               │  │
│  │       │                                                                                 │  │
│  │       ├── [For each file] Classify and store:                                           │  │
│  │       │       ├── isPhotoJpg  → photos[photoId].imageFile = f                           │  │
│  │       │       ├── isPatch    → patches[patchId] = { ..., imageFile: f }                 │  │
│  │       │       ├── isBotJson  → photos[photoId].botDetectionFile = f                     │  │
│  │       │       └── isUserJson → photos[photoId].userDetectionFile = f                    │  │
│  │       │                                                                                 │  │
│  │       ├── parseNightBotDetections()       ─── ingest-night.ts                           │  │
│  │       └── overlayNightUserDetections()    ─── ingest-night.ts                           │  │
│  │                                                                                         │  │
│  │   OUTPUT → projectsStore, sitesStore, deploymentsStore, nightsStore,                    │  │
│  │            photosStore, patchesStore, detectionsStore                                   │  │
│  │                                                                                         │  │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                           │                                                   │
│                    ┌──────────────────────┴──────────────────────┐                            │
│                    ▼                                             ▼                            │
│  ┌─────────────────────────────────────────┐  ┌─────────────────────────────────────────────┐ │
│  │        ingest-night.ts                  │  │        ingest-night.ts                      │ │
│  │                                         │  │                                             │ │
│  │  parseNightBotDetections()              │  │  overlayNightUserDetections()               │ │
│  │      │                                  │  │      │                                      │ │
│  │      ├── parseBotDetectionJsonSafely()  │  │      ├── parseUserDetectionJsonSafely()     │ │
│  │      │       └── ingest-json.ts         │  │      │       └── ingest-json.ts             │ │
│  │      │                                  │  │      │                                      │ │
│  │      ├── extractPatchFilename()         │  │      ├── extractPatchFilename()             │ │
│  │      │       └── ingest-json.ts         │  │      │       └── ingest-json.ts             │ │
│  │      │                                  │  │      │                                      │ │
│  │      └── buildDetectionFromBotShape()   │  │      └── buildDetectionFromIdentifiedJson   │ │
│  │              └── detection-shapes.ts    │  │              Shape()                        │ │
│  │                                         │  │              └── detection-shapes.ts        │ │
│  │  OUTPUT → patches{}, detections{}       │  │                                             │ │
│  │           (detectedBy: 'auto')          │  │  OUTPUT → detections{} (detectedBy: 'user') │ │
│  │                                         │  │                                             │ │
│  └─────────────────────────────────────────┘  └─────────────────────────────────────────────┘ │
│                                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                           species.ingest.ts                                             │  │
│  │                                                                                         │  │
│  │   ingestSpeciesListsFromFiles({ files })                                                │  │
│  │       │                                                                                 │  │
│  │       ├── readSpeciesCsvRows()                                                          │  │
│  │       │       └── csvToObjects()          ─── utils/csv.ts                              │  │
│  │       │                                                                                 │  │
│  │       ├── mapRowToTaxonRecords()          ─── models/taxonomy/csv-parser.ts             │  │
│  │       │                                                                                 │  │
│  │       ├── stableTaxonKey()                ─── models/taxonomy/keys.ts                   │  │
│  │       │                                                                                 │  │
│  │       └── invalidateSpeciesIndexForListId() ─── species-search.ts                       │  │
│  │                                                                                         │  │
│  │   OUTPUT → speciesListsStore                                                            │  │
│  │                                                                                         │  │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                               │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    NANOSTORES                                                 │
│                                                                                               │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│   │ projectsStore   │  │ sitesStore      │  │ deploymentsStore│  │ nightsStore             │  │
│   │ 1.projects.ts   │  │ 2.sites.ts      │  │ 3.deployments.ts│  │ 4.nights.ts             │  │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
│                                                                                               │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│   │ photosStore     │  │ patchesStore    │  │ detectionsStore │  │ speciesListsStore       │  │
│   │ photos.ts       │  │ 5.patches.ts    │  │ detections.ts   │  │ species-list.store.ts   │  │
│   └─────────────────┘  └─────────────────┘  └────────┬────────┘  └─────────────────────────┘  │
│                                                      │                                        │
│   ┌─────────────────┐  ┌─────────────────────────────┴────────────────────────────────────┐   │
│   │ nightSummaries  │  │                                                                  │   │
│   │ Store           │◄─┤  DetectionEntity {                                               │   │
│   │ night-summaries │  │    id, patchId, photoId, nightId,                                │   │
│   │ .ts             │  │    label?, taxon?: TaxonRecord,                                  │   │
│   └─────────────────┘  │    score?, direction?, shapeType?, points?,                      │   │
│                        │    detectedBy?: 'auto' | 'user',                                 │   │
│                        │    identifiedAt?, isError?, clusterId?,                          │   │
│                        │    morphospecies?, speciesListId?, speciesListDOI?,              │   │
│                        │    originalMothboxLabel?                                         │   │
│                        │  }                                                               │   │
│                        └──────────────────────────────────────────────────────────────────┘   │
│                                                                                               │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 2. IDENTIFY LAYER                                             │
│                                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                        UI ENTRY POINTS                                                  │  │
│  │                                                                                         │  │
│  │   ┌─────────────────────────────────────────────────────────────────────────────────┐   │  │
│  │   │  SelectionBar (selection-bar.tsx)                                               │   │  │
│  │   │      │                                                                          │   │  │
│  │   │      ├── [D] Identify → onIdentify() → opens IdentifyDialog                     │   │  │
│  │   │      ├── [A] Accept   → onAccept()   → acceptDetections()                       │   │  │
│  │   │      ├── [U] Unselect → onUnselect() → clears selection                         │   │  │
│  │   │      └── [⇧A] Select All → onSelectAll()                                        │   │  │
│  │   │                                                                                 │   │  │
│  │   └─────────────────────────────────────────────────────────────────────────────────┘   │  │
│  │                                           │                                             │  │
│  │                                           ▼                                             │  │
│  │   ┌─────────────────────────────────────────────────────────────────────────────────┐   │  │
│  │   │  IdentifyDialog (identify-dialog.tsx)                                           │   │  │
│  │   │      │                                                                          │   │  │
│  │   │      ├── Query Input                                                            │   │  │
│  │   │      │                                                                          │   │  │
│  │   │      ├── getSpeciesOptions()                                                    │   │  │
│  │   │      │       └── searchSpecies() ─── species-search.ts                          │   │  │
│  │   │      │                                                                          │   │  │
│  │   │      ├── getRecentOptions()      (from detectionsStore, detectedBy='user')      │   │  │
│  │   │      │                                                                          │   │  │
│  │   │      ├── getMorphoOptions()      (from detectionsStore, morphospecies field)    │   │  │
│  │   │      │                                                                          │   │  │
│  │   │      └── User Actions:                                                          │   │  │
│  │   │              ├── handleSelectTaxon(taxon)    → onSubmit(label, taxon)           │   │  │
│  │   │              ├── handleSubmitFreeText()      → onSubmit(label)                  │   │  │
│  │   │              ├── handleSelect('ERROR')       → onSubmit('ERROR')                │   │  │
│  │   │              ├── handleSubmitOrder/Family/Genus/Species/etc.                    │   │  │
│  │   │              │       └── openTaxonKeyDialog() → finalizeTaxonIdentification()   │   │  │
│  │   │              └── openTaxonomyGapFillDialog() (for missing ranks)                │   │  │
│  │   │                                                                                 │   │  │
│  │   └─────────────────────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                                         │  │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                           │                                                   │
│                                           ▼                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                    STORE ACTIONS (detections.ts)                                        │  │
│  │                                                                                         │  │
│  │   ┌─────────────────────────────────────────────────────────────────────────────────┐   │  │
│  │   │  labelDetections({ detectionIds, label?, taxon? })                              │   │  │
│  │   │      │                                                                          │   │  │
│  │   │      ├── Determine type:                                                        │   │  │
│  │   │      │       ├── isError? (label === 'ERROR')                                   │   │  │
│  │   │      │       ├── hasTaxon? (taxon with rank/genus/family/order/species)         │   │  │
│  │   │      │       └── isMorphospecies? (free text only)                              │   │  │
│  │   │      │                                                                          │   │  │
│  │   │      ├── For each detection:                                                    │   │  │
│  │   │      │       ├── isError     → updateDetectionAsError()                         │   │  │
│  │   │      │       ├── hasTaxon    → updateDetectionWithTaxon()                       │   │  │
│  │   │      │       └── morpho      → updateDetectionAsMorphospecies()                 │   │  │
│  │   │      │                                                                          │   │  │
│  │   │      ├── detectionsStore.set(updated)                                           │   │  │
│  │   │      │                                                                          │   │  │
│  │   │      └── updateNightSummariesAndScheduleSave()                                  │   │  │
│  │   │              ├── updateNightSummariesInMemory()                                 │   │  │
│  │   │              │       └── buildNightSummary() → nightSummariesStore.set()        │   │  │
│  │   │              └── scheduleSaveForNight() ──────────────────────────────────────► │   │  │
│  │   │                                                                                 │   │  │
│  │   └─────────────────────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                                         │  │
│  │   ┌─────────────────────────────────────────────────────────────────────────────────┐   │  │
│  │   │  acceptDetections({ detectionIds })                                             │   │  │
│  │   │      │                                                                          │   │  │
│  │   │      ├── Validate: detection has order?                                         │   │  │
│  │   │      ├── Group by (speciesListId, order)                                        │   │  │
│  │   │      ├── searchSpecies() for order taxon                                        │   │  │
│  │   │      └── labelDetections({ ids, taxon: orderTaxon })                            │   │  │
│  │   │                                                                                 │   │  │
│  │   └─────────────────────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                                         │  │
│  │   ┌─────────────────────────────────────────────────────────────────────────────────┐   │  │
│  │   │  resetDetections({ detectionIds })                                              │   │  │
│  │   │      │                                                                          │   │  │
│  │   │      ├── Group by photo                                                         │   │  │
│  │   │      ├── parseBotDetectionJsonSafely() for each photo                           │   │  │
│  │   │      ├── Find matching shape by patch_path                                      │   │  │
│  │   │      └── buildDetectionFromBotShape() → restore to auto state                   │   │  │
│  │   │                                                                                 │   │  │
│  │   └─────────────────────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                                         │  │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                           │                                                   │
│                                           ▼                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                    MODEL FUNCTIONS (detection-shapes.ts)                                │  │
│  │                                                                                         │  │
│  │   ┌─────────────────────────────────────────────────────────────────────────────────┐   │  │
│  │   │  updateDetectionWithTaxon({ existing, taxon, label?, speciesListId/DOI })       │   │  │
│  │   │      │                                                                          │   │  │
│  │   │      ├── Determine merge strategy:                                              │   │  │
│  │   │      │       ├── isFullSpecies? (genus + species + rank='species')              │   │  │
│  │   │      │       ├── isRankChanged? (different value at same rank)                  │   │  │
│  │   │      │       ├── isHigherRank + morphospecies? (preserve morpho)                │   │  │
│  │   │      │       └── parseBinomialName() for species-only input                     │   │  │
│  │   │      │                                                                          │   │  │
│  │   │      ├── mergeTaxonRanks() / normalizeSpeciesField()                            │   │  │
│  │   │      │       └── models/taxonomy/merge.ts                                       │   │  │
│  │   │      │                                                                          │   │  │
│  │   │      ├── computeFinalLabel()                                                    │   │  │
│  │   │      │                                                                          │   │  │
│  │   │      └── taxonWithName()                                                        │   │  │
│  │   │              └── models/taxonomy/extract.ts                                     │   │  │
│  │   │                                                                                 │   │  │
│  │   │      OUTPUT → DetectionEntity { detectedBy: 'user', identifiedAt: now, ... }    │   │  │
│  │   │                                                                                 │   │  │
│  │   └─────────────────────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                                         │  │
│  │   ┌─────────────────────────────────────────────────────────────────────────────────┐   │  │
│  │   │  updateDetectionAsMorphospecies({ existing, morphospecies, ... })               │   │  │
│  │   │      │                                                                          │   │  │
│  │   │      ├── Validate: hasHigherTaxonomyContext(existingTaxon)?                     │   │  │
│  │   │      │       └── models/taxonomy/merge.ts                                       │   │  │
│  │   │      │                                                                          │   │  │
│  │   │      ├── buildMorphospeciesTaxon({ existingTaxon })                             │   │  │
│  │   │      │       └── models/taxonomy/merge.ts                                       │   │  │
│  │   │      │                                                                          │   │  │
│  │   │      └── taxonWithName()                                                        │   │  │
│  │   │                                                                                 │   │  │
│  │   │      OUTPUT → DetectionEntity { morphospecies: text, detectedBy: 'user', ... }  │   │  │
│  │   │               or null if no context                                             │   │  │
│  │   │                                                                                 │   │  │
│  │   └─────────────────────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                                         │  │
│  │   ┌─────────────────────────────────────────────────────────────────────────────────┐   │  │
│  │   │  updateDetectionAsError({ existing, ... })                                      │   │  │
│  │   │      │                                                                          │   │  │
│  │   │      └── OUTPUT → DetectionEntity {                                             │   │  │
│  │   │                     label: 'ERROR',                                             │   │  │
│  │   │                     isError: true,                                              │   │  │
│  │   │                     taxon: undefined,                                           │   │  │
│  │   │                     morphospecies: undefined,                                   │   │  │
│  │   │                     detectedBy: 'user'                                          │   │  │
│  │   │                   }                                                             │   │  │
│  │   │                                                                                 │   │  │
│  │   └─────────────────────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                                         │  │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                               │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 3. PERSIST LAYER                                              │
│                                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                        detection-persistence.ts                                         │  │
│  │                                                                                         │  │
│  │   scheduleSaveForNight(nightId)                                                         │  │
│  │       │                                                                                 │  │
│  │       └── calls scheduleSaveUserDetections() ─── files.writer.ts                        │  │
│  │                                                                                         │  │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                           │                                                   │
│                                           ▼                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                           files.writer.ts                                               │  │
│  │                                                                                         │  │
│  │   scheduleSaveUserDetections({ nightId, delayMs=400 })                                  │  │
│  │       │                                                                                 │  │
│  │       ├── Debounce with window.setTimeout()                                             │  │
│  │       └── exportUserDetectionsForNight({ nightId })                                     │  │
│  │                                                                                         │  │
│  │   exportUserDetectionsForNight({ nightId })                                             │  │
│  │       │                                                                                 │  │
│  │       ├── idbGet('projectsRoot')          ─── utils/index-db.ts                         │  │
│  │       ├── ensureReadWritePermission()     ─── files.persistence.ts                      │  │
│  │       │                                                                                 │  │
│  │       ├── Filter detections: nightId + detectedBy === 'user'                            │  │
│  │       ├── Group by photoId                                                              │  │
│  │       │                                                                                 │  │
│  │       ├── For each photo in night:                                                      │  │
│  │       │       ├── buildUserIdentifiedJson({ baseName, detections })                     │  │
│  │       │       │       └── buildIdentifiedJsonShapeFromDetection()                       │  │
│  │       │       │               └── detection-shapes.ts                                   │  │
│  │       │       │                                                                         │  │
│  │       │       └── writeJson(root, path, json)                                           │  │
│  │       │               └── Writes: {nightDiskPath}/{photoBase}_identified.json           │  │
│  │       │                                                                                 │  │
│  │       └── buildNightSummary() + writeJson()                                             │  │
│  │               └── Writes: {nightDiskPath}/night_summary.json                            │  │
│  │                                                                                         │  │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                           │                                                   │
│                                           ▼                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                        OUTPUT FILES                                                     │  │
│  │                                                                                         │  │
│  │   {nightDiskPath}/                                                                      │  │
│  │       ├── {photoBase}_identified.json                                                   │  │
│  │       │       {                                                                         │  │
│  │       │         "version": "1",                                                         │  │
│  │       │         "photoBase": "fondoGorila_2025_01_28__04_59_06_HDR0",                    │  │
│  │       │         "shapes": [                                                             │  │
│  │       │           {                                                                     │  │
│  │       │             "patch_path": "patches/...",                                        │  │
│  │       │             "label": "Diptera",                                                 │  │
│  │       │             "kingdom": "Animalia", "phylum": "Arthropoda",                      │  │
│  │       │             "class": "Insecta", "order": "Diptera",                             │  │
│  │       │             "family": "...", "genus": "...", "species": "...",                  │  │
│  │       │             "taxonID": "...", "taxonRank": "order",                             │  │
│  │       │             "identifier_human": "JD",                                           │  │
│  │       │             "timestamp_ID_human": 1234567890,                                   │  │
│  │       │             "is_error": false                                                   │  │
│  │       │           }                                                                     │  │
│  │       │         ]                                                                       │  │
│  │       │       }                                                                         │  │
│  │       │                                                                                 │  │
│  │       └── night_summary.json                                                            │  │
│  │               {                                                                         │  │
│  │                 "nightId": "...",                                                       │  │
│  │                 "totalDetections": 42,                                                  │  │
│  │                 "identifiedCount": 20,                                                  │  │
│  │                 "errorCount": 2,                                                        │  │
│  │                 ...                                                                     │  │
│  │               }                                                                         │  │
│  │                                                                                         │  │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                               │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 4. EXPORT LAYER                                               │
│                                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                           darwin-csv.ts                                                 │  │
│  │                                                                                         │  │
│  │   exportNightDarwinCSV({ nightId })                                                     │  │
│  │       │                                                                                 │  │
│  │       ├── idbGet('projectsRoot')                                                        │  │
│  │       ├── ensureReadWritePermission()                                                   │  │
│  │       │                                                                                 │  │
│  │       ├── generateNightDarwinCSVString({ nightId })                                     │  │
│  │       │       │                                                                         │  │
│  │       │       ├── Get detections, photos, patches for night                             │  │
│  │       │       │                                                                         │  │
│  │       │       ├── For each detection:                                                   │  │
│  │       │       │       └── buildDarwinShapeFromDetection()                               │  │
│  │       │       │               │                                                         │  │
│  │       │       │               ├── extractTaxonomyFieldsFromDetection()                  │  │
│  │       │       │               │       └── models/taxonomy/extract.ts                    │  │
│  │       │       │               │                                                         │  │
│  │       │       │               ├── extractTaxonMetadataFromDetection()                   │  │
│  │       │       │               │       └── models/taxonomy/extract.ts                    │  │
│  │       │       │               │                                                         │  │
│  │       │       │               ├── getValidScientificNameForExport()                     │  │
│  │       │       │               │       └── models/taxonomy/morphospecies.ts              │  │
│  │       │       │               │                                                         │  │
│  │       │       │               ├── deriveTaxonNameFromDetection()                        │  │
│  │       │       │               │       └── models/taxonomy/extract.ts                    │  │
│  │       │       │               │                                                         │  │
│  │       │       │               └── Returns DarwinRow:                                    │  │
│  │       │       │                     { kingdom, phylum, class, order, family,            │  │
│  │       │       │                       genus, species, morphospecies, taxonID,           │  │
│  │       │       │                       scientificName, name, eventDate, eventTime,       │  │
│  │       │       │                       identifiedBy, detectionBy, filepath, ... }        │  │
│  │       │       │                                                                         │  │
│  │       │       └── objectsToCSV({ objects, headers })                                    │  │
│  │       │               └── utils/csv.ts                                                  │  │
│  │       │                                                                                 │  │
│  │       └── fsaaWriteText(root, pathParts, csv)                                           │  │
│  │               └── Writes: {nightDiskPath}/{dataset}_{deployment}_{night}_exported-{date}.csv
│  │                                                                                         │  │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                           rs-summary.ts                                                 │  │
│  │                                                                                         │  │
│  │   exportNightSummaryRS({ nightId })                                                     │  │
│  │       │                                                                                 │  │
│  │       ├── generateNightDarwinCSVString({ nightId })                                     │  │
│  │       │                                                                                 │  │
│  │       ├── Get unique identified detections by species key                               │  │
│  │       │                                                                                 │  │
│  │       ├── For each unique species:                                                      │  │
│  │       │       ├── Get patch image file                                                  │  │
│  │       │       └── Add to ZIP: images/{patchId}__{scientificName}.jpg                    │  │
│  │       │                                                                                 │  │
│  │       ├── zipSync({ 'darwin_export.csv': csv, 'images/...': bytes })                    │  │
│  │       │       └── fflate library                                                        │  │
│  │       │                                                                                 │  │
│  │       └── fsaaWriteBytes(root, pathParts, zipped)                                       │  │
│  │               └── Writes: {nightDiskPath}/rs_summary.zip                                │  │
│  │                                                                                         │  │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                        OUTPUT FILES                                                     │  │
│  │                                                                                         │  │
│  │   {nightDiskPath}/                                                                      │  │
│  │       ├── {dataset}_{deployment}_{night}_exported-{YYYY-MM_DD}.csv                      │  │
│  │       │       species_list_doi,kingdom,phylum,class,order,family,genus,species,         │  │
│  │       │       morphospecies,taxonID,commonName,scientificName,name,deployment,          │  │
│  │       │       image_id,identifiedBy,detectionBy,detection_confidence,ID_confidence,     │  │
│  │       │       mothbox,filepath,original_mothbox_identifciation,eventDate,eventTime,     │  │
│  │       │       UTCOFFSET,verbatimEventDate,basisOfRecord,datasetID,parentEventID,        │  │
│  │       │       eventID,occurrenceID                                                      │  │
│  │       │                                                                                 │  │
│  │       └── rs_summary.zip                                                                │  │
│  │               ├── darwin_export.csv                                                     │  │
│  │               └── images/                                                               │  │
│  │                       └── {patchId}__{scientificName}.jpg                               │  │
│  │                                                                                         │  │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                               │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Function Call Graph

### Ingest Flow
```
User selects folder
       │
       ▼
singlePassIngest()
       │
       ├──► validateProjectRootSelection()
       │
       ├──► applyIndexedFilesState()
       │         │
       │         └──► preloadNightSummariesFromIndexed()
       │
       └──► ingestFilesToStores({ parseDetectionsForNightId: null })
                    │
                    └──► parsePathParts() [for each file]
                              │
                              └──► Classify: isPhotoJpg, isPatch, isBotJson, isUserJson
                                        │
                                        └──► Store in temp objects → set stores
```

### Night Load Flow (Lazy Loading)
```
User navigates to night view
       │
       ▼
useNightIngest() hook
       │
       └──► ingestDetectionsForNight({ nightId })
                    │
                    └──► ingestFilesToStores({ parseDetectionsForNightId: nightId })
                              │
                              ├──► parseNightBotDetections()
                              │         │
                              │         ├──► parseBotDetectionJsonSafely()
                              │         │
                              │         ├──► extractPatchFilename()
                              │         │
                              │         ├──► findPatchFileForPatchId()
                              │         │
                              │         └──► buildDetectionFromBotShape()
                              │                   │
                              │                   ├──► extractTaxonomyFromShape()
                              │                   │
                              │                   └──► buildTaxonFromShape()
                              │
                              └──► overlayNightUserDetections()
                                        │
                                        ├──► parseUserDetectionJsonSafely()
                                        │
                                        └──► buildDetectionFromIdentifiedJsonShape()
                                                  │
                                                  └──► extractMorphospeciesFromShape()
```

### Identification Flow
```
User presses 'D' or clicks Identify
       │
       ▼
IdentifyDialog opens
       │
       ├──► getSpeciesOptions() ──► searchSpecies()
       │
       ├──► getRecentOptions()
       │
       └──► getMorphoOptions()
                    │
                    ▼
User selects/enters identification
       │
       ├──► handleSelectTaxon()
       │         │
       │         └──► detectMissingRanks()
       │                   │
       │                   ├──► [if gaps] openTaxonomyGapFillDialog()
       │                   │
       │                   └──► onSubmit(label, taxon)
       │
       ├──► handleSubmitFreeText() ──► onSubmit(label)
       │
       └──► handleSelect('ERROR') ──► onSubmit('ERROR')
                    │
                    ▼
labelDetections({ detectionIds, label?, taxon? })
       │
       ├──► [isError] updateDetectionAsError()
       │
       ├──► [hasTaxon] updateDetectionWithTaxon()
       │         │
       │         ├──► isRankHigherThanSpecies()
       │         │
       │         ├──► mergeTaxonRanks()
       │         │
       │         ├──► normalizeSpeciesField()
       │         │
       │         ├──► buildMorphospeciesTaxon()
       │         │
       │         └──► taxonWithName()
       │
       └──► [morpho] updateDetectionAsMorphospecies()
                    │
                    └──► hasHigherTaxonomyContext()
                              │
                              ▼
detectionsStore.set(updated)
       │
       ▼
updateNightSummariesAndScheduleSave()
       │
       ├──► updateNightSummariesInMemory()
       │         │
       │         └──► buildNightSummary() ──► nightSummariesStore.set()
       │
       └──► scheduleSaveForNight()
                    │
                    ▼
scheduleSaveUserDetections() [debounced 400ms]
       │
       ▼
exportUserDetectionsForNight()
       │
       ├──► Group detections by photo
       │
       ├──► buildUserIdentifiedJson()
       │         │
       │         └──► buildIdentifiedJsonShapeFromDetection()
       │
       ├──► writeJson() ──► {photoBase}_identified.json
       │
       └──► writeJson() ──► night_summary.json
```

### Export Flow
```
User clicks Export Darwin CSV
       │
       ▼
exportNightDarwinCSV({ nightId })
       │
       └──► generateNightDarwinCSVString()
                    │
                    ├──► [for each detection] buildDarwinShapeFromDetection()
                    │         │
                    │         ├──► extractTaxonomyFieldsFromDetection()
                    │         │
                    │         ├──► extractTaxonMetadataFromDetection()
                    │         │
                    │         ├──► getValidScientificNameForExport()
                    │         │
                    │         └──► deriveTaxonNameFromDetection()
                    │
                    └──► objectsToCSV()
                              │
                              ▼
fsaaWriteText() ──► {dataset}_{deployment}_{night}_exported-{date}.csv


User clicks Export RS Summary
       │
       ▼
exportNightSummaryRS({ nightId })
       │
       ├──► generateNightDarwinCSVString()
       │
       ├──► Collect unique species images
       │
       ├──► zipSync()
       │
       └──► fsaaWriteBytes() ──► rs_summary.zip
```

---

## File Reference Map

### 1. Ingest Layer (`src/features/data-flow/1.ingest/`)
| File | Key Functions |
|------|---------------|
| `files.single-pass.ts` | `singlePassIngest()` |
| `files.initialize.ts` | `applyIndexedFilesState()`, `preloadNightSummariesFromIndexed()` |
| `files.validation.ts` | `validateProjectRootSelection()` |
| `ingest.ts` | `ingestFilesToStores()`, `ingestDetectionsForNight()` |
| `ingest-paths.ts` | `parsePathParts()`, `extractNightDiskPathFromIndexedPath()` |
| `ingest-night.ts` | `parseNightBotDetections()`, `overlayNightUserDetections()` |
| `ingest-json.ts` | `parseBotDetectionJsonSafely()`, `parseUserDetectionJsonSafely()`, `extractPatchFilename()` |
| `species.ingest.ts` | `ingestSpeciesListsFromFiles()` |

### 2. Identify Layer (`src/features/data-flow/2.identify/`)
| File | Key Functions |
|------|---------------|
| `identify-dialog.tsx` | `IdentifyDialog`, `handleSelectTaxon()`, `handleSubmitFreeText()` |
| `identify.ts` | `identifyDetection()`, `identifyDetections()` |
| `species-search.ts` | `searchSpecies()`, `invalidateSpeciesIndexForListId()` |
| `species-list.store.ts` | `speciesListsStore`, `TaxonRecord` type |
| `species-picker.tsx` | `SpeciesPicker` component |

### 3. Persist Layer (`src/features/data-flow/3.persist/`)
| File | Key Functions |
|------|---------------|
| `detection-persistence.ts` | `scheduleSaveForNight()`, `setDetectionSaveScheduler()` |
| `files.writer.ts` | `scheduleSaveUserDetections()`, `exportUserDetectionsForNight()`, `writeMorphoLinksToDisk()` |
| `files.persistence.ts` | `ensureReadWritePermission()`, `persistenceConstants` |

### 4. Export Layer (`src/features/data-flow/4.export/`)
| File | Key Functions |
|------|---------------|
| `darwin-csv.ts` | `exportNightDarwinCSV()`, `generateNightDarwinCSVString()`, `buildDarwinShapeFromDetection()` |
| `rs-summary.ts` | `exportNightSummaryRS()` |

### Model Layer (`src/models/`)
| File | Key Functions |
|------|---------------|
| `detection-shapes.ts` | `buildDetectionFromBotShape()`, `buildDetectionFromIdentifiedJsonShape()`, `buildIdentifiedJsonShapeFromDetection()`, `updateDetectionWithTaxon()`, `updateDetectionAsMorphospecies()`, `updateDetectionAsError()` |
| `taxonomy/extract.ts` | `extractTaxonomyFromShape()`, `extractTaxonomyFieldsFromDetection()`, `deriveTaxonNameFromDetection()`, `taxonWithName()` |
| `taxonomy/merge.ts` | `mergeTaxonRanks()`, `normalizeSpeciesField()`, `buildMorphospeciesTaxon()`, `hasHigherTaxonomyContext()` |
| `taxonomy/morphospecies.ts` | `extractMorphospeciesFromShape()`, `getValidScientificNameForExport()` |
| `taxonomy/keys.ts` | `stableTaxonKey()` |
| `taxonomy/csv-parser.ts` | `mapRowToTaxonRecords()` |

### Store Layer (`src/stores/entities/`)
| File | Key Exports |
|------|-------------|
| `detections.ts` | `detectionsStore`, `labelDetections()`, `acceptDetections()`, `resetDetections()` |
| `photos.ts` | `photosStore`, `PhotoEntity` |
| `5.patches.ts` | `patchesStore`, `PatchEntity` |
| `night-summaries.ts` | `nightSummariesStore`, `buildNightSummary()` |
| `1.projects.ts` | `projectsStore` |
| `2.sites.ts` | `sitesStore` |
| `3.deployments.ts` | `deploymentsStore` |
| `4.nights.ts` | `nightsStore` |

---

## Data Entity Relationships

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              ENTITY HIERARCHY                                        │
│                                                                                      │
│   ProjectEntity                                                                      │
│       │                                                                              │
│       └──► SiteEntity                                                                │
│               │                                                                      │
│               └──► DeploymentEntity                                                  │
│                       │                                                              │
│                       └──► NightEntity ◄────────────────────────────────────────┐    │
│                               │                                                 │    │
│                               │                                                 │    │
│   ┌───────────────────────────┴───────────────────────────┐                     │    │
│   │                                                       │                     │    │
│   ▼                                                       ▼                     │    │
│   PhotoEntity                                      NightSummaryEntity           │    │
│   {                                                {                            │    │
│     id: string                                       nightId: string            │    │
│     name: string                                     totalDetections: number    │    │
│     nightId: string ──────────────────────────────►  identifiedCount: number    │    │
│     imageFile?: IndexedFile                          errorCount: number         │    │
│     botDetectionFile?: IndexedFile                   ...                        │    │
│     userDetectionFile?: IndexedFile                }                            │    │
│   }                                                                             │    │
│       │                                                                         │    │
│       │                                                                         │    │
│       ▼                                                                         │    │
│   PatchEntity                                                                   │    │
│   {                                                                             │    │
│     id: string (patch filename)                                                 │    │
│     name: string                                                                │    │
│     nightId: string ────────────────────────────────────────────────────────────┘    │
│     photoId: string ──────────────────────────────────────────────────────┐          │
│     imageFile?: IndexedFile                                               │          │
│   }                                                                       │          │
│       │                                                                   │          │
│       │                                                                   │          │
│       ▼                                                                   │          │
│   DetectionEntity                                                         │          │
│   {                                                                       │          │
│     id: string (= patchId)                                                │          │
│     patchId: string ──────────────────────────────────────────────────────┤          │
│     photoId: string ◄─────────────────────────────────────────────────────┘          │
│     nightId: string ─────────────────────────────────────────────────────────────────┘
│     label?: string                                                                   │
│     taxon?: TaxonRecord {                                                            │
│       kingdom?, phylum?, class?, order?, family?, genus?, species?,                  │
│       scientificName?, taxonRank?, taxonID?, acceptedTaxonKey?,                      │
│       vernacularName?                                                                │
│     }                                                                                │
│     score?: number                                                                   │
│     direction?: number                                                               │
│     shapeType?: string                                                               │
│     points?: number[][]                                                              │
│     detectedBy?: 'auto' | 'user'                                                     │
│     identifiedAt?: number                                                            │
│     isError?: boolean                                                                │
│     clusterId?: number                                                               │
│     morphospecies?: string                                                           │
│     speciesListId?: string                                                           │
│     speciesListDOI?: string                                                          │
│     originalMothboxLabel?: string                                                    │
│   }                                                                                  │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## State Transitions

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                        DETECTION STATE MACHINE                                        │
│                                                                                       │
│                                                                                       │
│   ┌─────────────────────┐                                                             │
│   │                     │                                                             │
│   │   NOT LOADED        │                                                             │
│   │                     │                                                             │
│   └──────────┬──────────┘                                                             │
│              │                                                                        │
│              │ parseNightBotDetections()                                              │
│              │ buildDetectionFromBotShape()                                           │
│              ▼                                                                        │
│   ┌─────────────────────┐                                                             │
│   │                     │                                                             │
│   │   AUTO DETECTED     │◄──────────────────────────────────────────────┐             │
│   │   detectedBy: auto  │                                               │             │
│   │                     │                                               │             │
│   └──────────┬──────────┘                                               │             │
│              │                                                          │             │
│              │ overlayNightUserDetections()                             │             │
│              │ (if _identified.json exists)                             │             │
│              │                                                          │             │
│              │                                                          │             │
│   ┌──────────┴─────────────────────────────────────────────┐            │             │
│   │                                                        │            │             │
│   │  labelDetections() / acceptDetections()                │            │             │
│   │                                                        │            │             │
│   ▼                        ▼                        ▼      │            │             │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │            │             │
│   │              │  │              │  │              │     │            │             │
│   │  IDENTIFIED  │  │  MORPHO      │  │  ERROR       │     │            │             │
│   │  WITH TAXON  │  │  SPECIES     │  │              │     │            │             │
│   │              │  │              │  │              │     │            │             │
│   │ detectedBy:  │  │ detectedBy:  │  │ detectedBy:  │     │            │             │
│   │   user       │  │   user       │  │   user       │     │            │             │
│   │ taxon: {...} │  │ morpho: str  │  │ isError: true│     │            │             │
│   │              │  │              │  │              │     │            │             │
│   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │            │             │
│          │                 │                 │             │            │             │
│          │                 │                 │             │            │             │
│          │                 │                 │             │            │             │
│          └─────────────────┴─────────────────┴─────────────┘            │             │
│                            │                                            │             │
│                            │ resetDetections()                          │             │
│                            │ buildDetectionFromBotShape()               │             │
│                            │                                            │             │
│                            └────────────────────────────────────────────┘             │
│                                                                                       │
│                                                                                       │
│   PERSISTENCE TRIGGER:                                                                │
│   Any state change → scheduleSaveForNight() → exportUserDetectionsForNight()          │
│                                                                                       │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

---

## File I/O Summary

### Input Files (Read)
| File Pattern | Parser | Store |
|--------------|--------|-------|
| `*_botdetection.json` | `parseBotDetectionJsonSafely()` | `detectionsStore` |
| `*_identified.json` | `parseUserDetectionJsonSafely()` | `detectionsStore` |
| `patches/*.jpg` | Direct file reference | `patchesStore` |
| `*.jpg` (photos) | Direct file reference | `photosStore` |
| `species/*.csv` | `csvToObjects()` | `speciesListsStore` |
| `night_summary.json` | JSON.parse | `nightSummariesStore` |

### Output Files (Write)
| File Pattern | Generator | Trigger |
|--------------|-----------|---------|
| `*_identified.json` | `buildUserIdentifiedJson()` | `scheduleSaveForNight()` |
| `night_summary.json` | `buildNightSummary()` | `scheduleSaveForNight()` |
| `*_exported-*.csv` | `generateNightDarwinCSVString()` | User export action |
| `rs_summary.zip` | `exportNightSummaryRS()` | User export action |
| `morpho_links.json` | `writeMorphoLinksToDisk()` | Morpho link changes |


