import { useEffect, useRef, useState } from 'react'
import { useStore } from '@nanostores/react'
import { filesByNightIdStore, patchFileMapByNightStore, indexedFilesStore } from '~/features/folder-processing/files.state'
import { detectionsStore } from '~/stores/entities/detections'
import { ingestDetectionsForNight } from '~/features/ingest/ingest'
import { resetNightIngestProgress, setNightIngestTotal, getActiveNightIds } from '~/stores/ui'
import { clearFileObjectsForInactiveNights } from '~/stores/entities'

const inFlightNightIds = new Set<string>()

export function useNightIngest(params: { nightId: string }) {
  const { nightId } = params

  const indexedFiles = useStore(indexedFilesStore)
  const filesByNight = useStore(filesByNightIdStore)
  const patchMapByNight = useStore(patchFileMapByNightStore)

  const [isNightIngesting, setIsNightIngesting] = useState(false)
  const ingestRunRef = useRef(0)

  useEffect(() => {
    const hasAnyForNight = Object.values(detectionsStore.get() || {}).some((d: any) => d?.nightId === nightId)
    if (hasAnyForNight) return
    if (!indexedFiles?.length) return
    if (inFlightNightIds.has(nightId)) {
      console.log('⏭️ night: ingest already in-flight', { nightId })
      return
    }
    const perNight = filesByNight?.[nightId] || indexedFiles
    const patchMap = patchMapByNight?.[nightId]
    const runId = ++ingestRunRef.current

    setIsNightIngesting(true)
    console.log('🌀 night: ingesting detections for night', {
      nightId,
      filesCount: perNight?.length || 0,
      patchMapSize: patchMap ? Object.keys(patchMap).length : 0,
    })
    // Initialize progress from prebuilt patch map (trust the store)
    const total = patchMap ? Object.keys(patchMap).length : 0
    resetNightIngestProgress({ nightId })
    setNightIngestTotal({ nightId, total })
    inFlightNightIds.add(nightId)
    void ingestDetectionsForNight({ files: perNight, nightId, patchMap }).finally(() => {
      if (ingestRunRef.current === runId) setIsNightIngesting(false)
      inFlightNightIds.delete(nightId)
      const activeNightIds = getActiveNightIds()
      clearFileObjectsForInactiveNights({ activeNightIds })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nightId, indexedFiles])

  return { isNightIngesting }
}
