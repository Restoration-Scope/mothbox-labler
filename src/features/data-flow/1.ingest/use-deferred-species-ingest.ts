import { useEffect } from 'react'
import { startTransition } from 'react'
import { useStore } from '@nanostores/react'
import { indexedFilesStore } from './files.state'
import { ingestSpeciesListsFromFiles } from './species.ingest'
import { loadProjectSpeciesSelection } from '~/stores/species/project-species-list'

export function useDeferredSpeciesIngest() {
  const indexedFiles = useStore(indexedFilesStore)

  useEffect(() => {
    if (!indexedFiles?.length) return

    console.log('🌀 useDeferredSpeciesIngest: starting deferred species ingest', { fileCount: indexedFiles.length })

    startTransition(() => {
      const tStart = performance.now()
      void ingestSpeciesListsFromFiles({ files: indexedFiles }).then(() => {
        const ms = Math.round(performance.now() - tStart)
        console.log('✅ useDeferredSpeciesIngest: species ingest complete', { ms })
      })
      void loadProjectSpeciesSelection()
    })
  }, [indexedFiles])
}
