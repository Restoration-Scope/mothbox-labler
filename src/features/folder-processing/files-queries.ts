import { useIsMutating, useMutation, useQuery } from '@tanstack/react-query'
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
  return restoreQuery.isLoading || isOpening
}
