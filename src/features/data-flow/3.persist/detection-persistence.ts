/**
 * Detection persistence scheduling.
 * Handles scheduling saves when detections are updated.
 * Separated from detections.ts to avoid circular dependencies.
 */

let scheduleSaveUserDetections: ((params: { nightId: string }) => void) | undefined

/**
 * Sets the save function to use for scheduling persistence.
 * Called during app initialization.
 */
export function setDetectionSaveScheduler(scheduler: (params: { nightId: string }) => void) {
  scheduleSaveUserDetections = scheduler
}

/**
 * Schedules a save for the given night ID.
 * No-op if scheduler hasn't been initialized.
 */
export function scheduleSaveForNight(nightId: string) {
  if (scheduleSaveUserDetections) {
    scheduleSaveUserDetections({ nightId })
  }
}
