import { useIsMutating, useMutation, useQuery } from '@tanstack/react-query'
import { useStore } from '@nanostores/react'
import { appReadyStore, userSessionLoadedStore } from '~/stores/ui'
import { openDirectory, tryRestoreFromSavedDirectory } from './files.service'

export function useRestoreDirectoryQuery() {
  const query = useQuery({
    queryKey: ['fs', 'restore'],
    queryFn: async () => {
      const restored = await tryRestoreFromSavedDirectory()
      return restored
    },
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  const res = query
  return res
}

export function useOpenDirectoryMutation() {
  const mutation = useMutation({
    mutationKey: ['fs', 'open'],
    mutationFn: async () => {
      await openDirectory()
    },
    retry: false,
  })

  const res = mutation
  return res
}

export function useIsLoadingFolders() {
  const restoreQuery = useRestoreDirectoryQuery()
  const isOpening = useIsMutating({ mutationKey: ['fs', 'open'] }) > 0
  const sessionLoaded = useStore(userSessionLoadedStore)
  return !sessionLoaded || restoreQuery.isLoading || isOpening
}

export function useAppLoading() {
  const restoreQuery = useRestoreDirectoryQuery()
  const isOpening = useIsMutating({ mutationKey: ['fs', 'open'] }) > 0
  const sessionLoaded = useStore(userSessionLoadedStore)
  const isLoading = !sessionLoaded || restoreQuery.isLoading || isOpening
  return { isLoading, sessionLoaded, isOpening, restoring: restoreQuery.isLoading }
}

export function useAppReady() {
  const ready = useStore(appReadyStore)
  return !!ready
}
