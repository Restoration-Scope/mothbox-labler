import { filesByNightIdStore, patchFileMapByNightStore, type IndexedFile } from './files.state'

type ParsedParts = {
  nightId?: string
  isPatch?: boolean
  fileName?: string
}

export function buildNightIndexes(params: { files: IndexedFile[] }) {
  const { files } = params

  if (!Array.isArray(files) || files.length === 0) {
    filesByNightIdStore.set({})
    patchFileMapByNightStore.set({})
    return
  }

  const byNight: Record<string, IndexedFile[]> = {}
  const patchMapByNight: Record<string, Record<string, IndexedFile>> = {}

  for (const f of files) {
    const parts = fastParsePathParts(f.path)
    const nightId = parts?.nightId
    if (!nightId) continue

    if (!byNight[nightId]) byNight[nightId] = []
    byNight[nightId].push(f)

    if (parts?.isPatch && parts?.fileName) {
      const patchId = parts.fileName
      const bucket = patchMapByNight[nightId] || (patchMapByNight[nightId] = {})
      bucket[patchId.toLowerCase()] = f
    }
  }

  filesByNightIdStore.set(byNight)
  patchFileMapByNightStore.set(patchMapByNight)
}

function fastParsePathParts(path: string): ParsedParts | null {
  const normalized = (path ?? '').replaceAll('\\', '/').replace(/^\/+/, '')
  const segments = normalized.split('/').filter(Boolean)
  if (segments.length < 4) return null

  // Supports two folder layouts:
  // A) project/site/deployment/night/(patches/)?file
  // B) project/deployment/night/(patches/)?file (site is derived from deployment)

  // Try A
  const nightA = segments[3]
  const looksLikeNightA = isLikelyNightFolderName(nightA)
  if (looksLikeNightA) {
    const isPatchesFolder = segments[4] === 'patches'
    const fileName = isPatchesFolder ? segments[5] : segments[4]
    if (!fileName) return { nightId: `${segments[0]}/${segments[1]}/${segments[2]}/${segments[3]}` }
    const lower = fileName.toLowerCase()
    const isPatch = isPatchesFolder && lower.endsWith('.jpg')
    const nightId = `${segments[0]}/${segments[1]}/${segments[2]}/${segments[3]}`
    return { nightId, isPatch, fileName }
  }

  // Try B
  const nightB = segments[2]
  const looksLikeNightB = isLikelyNightFolderName(nightB)
  if (looksLikeNightB) {
    const project = segments[0]
    const deployment = segments[1]
    const site = deriveSiteFromDeploymentFolder(deployment)
    const nightId = `${project}/${site}/${deployment}/${nightB}`
    const isPatchesFolder = segments[3] === 'patches'
    const fileName = isPatchesFolder ? segments[4] : segments[3]
    if (!fileName) return { nightId }
    const lower = fileName.toLowerCase()
    const isPatch = isPatchesFolder && lower.endsWith('.jpg')
    return { nightId, isPatch, fileName }
  }

  return null
}

function isLikelyNightFolderName(name: string | undefined) {
  const n = (name ?? '').toLowerCase()
  if (!n) return false
  if (/^\d{4}-\d{2}-\d{2}$/.test(n)) return true
  if (n.startsWith('night')) return true
  return false
}

function deriveSiteFromDeploymentFolder(deploymentFolderName: string) {
  const name = deploymentFolderName ?? ''
  if (!name) return ''
  const parts = name.split('_').filter(Boolean)
  if (parts.length >= 2) return parts[1]
  return name
}
