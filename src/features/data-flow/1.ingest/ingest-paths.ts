export function isLikelyNightFolderName(name: string) {
  const n = (name ?? '').toLowerCase()
  if (!n) return false
  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(n)
  if (isDate) return true
  if (n.startsWith('night')) return true
  return false
}

export function deriveSiteFromDeploymentFolder(deploymentFolderName: string) {
  const name = deploymentFolderName ?? ''
  if (!name) return ''
  const parts = name.split('_').filter(Boolean)
  if (parts.length >= 2) return parts[1]
  return name
}

export function parsePathParts(params: { path: string }) {
  const { path } = params
  const normalized = (path ?? '').replaceAll('\\', '/').replace(/^\/+/, '')
  const segments = normalized.split('/').filter(Boolean)
  if (segments.length < 4) return null
  let project = ''
  let site = ''
  let deployment = ''
  let night = ''
  let rest: string[] = []

  if (segments.length >= 5) {
    ;[project, site, deployment, night, ...rest] = segments
  } else {
    ;[project, deployment, night, ...rest] = segments
    site = deriveSiteFromDeploymentFolder(deployment)
  }

  if (!isLikelyNightFolderName(night)) return null
  const isPatchesFolder = rest[0] === 'patches'

  const fileName = isPatchesFolder ? rest[1] : rest[0]
  if (!fileName) return null

  const lower = fileName.toLowerCase()
  const isPatch = isPatchesFolder && lower.endsWith('.jpg')
  const isPhotoJpg = !isPatchesFolder && lower.endsWith('.jpg')
  const isBotJson = lower.endsWith('_botdetection.json')
  const isUserJson = lower.endsWith('_identified.json')
  const baseName = isBotJson
    ? fileName.slice(0, -'_botdetection.json'.length)
    : lower.endsWith('_identified.json')
    ? fileName.slice(0, -'_identified.json'.length)
    : fileName.endsWith('.jpg')
    ? fileName.slice(0, -'.jpg'.length)
    : fileName

  return { project, site, deployment, night, isPatch, isPhotoJpg, isBotJson, isUserJson, fileName, baseName }
}

export function extractNightDiskPathFromIndexedPath(path: string) {
  const normalized = (path ?? '').replaceAll('\\', '/').replace(/^\/+/, '')
  const segments = normalized.split('/').filter(Boolean)
  if (segments.length < 2) return ''
  const withoutFile = segments.slice(0, -1)
  const joined = withoutFile.join('/')
  return joined
}
