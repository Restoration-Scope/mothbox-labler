import { useMemo } from 'react'
import { useStore } from '@nanostores/react'
import { useParams, Link } from '@tanstack/react-router'
import { nightSummariesStore } from '~/stores/entities/night-summaries'
import { nightsStore } from '~/stores/entities/4.nights'

export function MorphospeciesDetail() {
  const params = useParams({ from: '/morphospecies/$key' })
  const key = params.key || ''

  const summaries = useStore(nightSummariesStore)
  const nights = useStore(nightsStore)

  const usage = useMemo(() => {
    const nightIds: string[] = []
    const projectIds = new Set<string>()
    for (const [nightId, s] of Object.entries(summaries ?? {})) {
      const count = (s as any)?.morphoCounts?.[key]
      if (!count) continue
      nightIds.push(nightId)
      const projectId = (nights?.[nightId] as any)?.projectId
      if (projectId) projectIds.add(projectId)
    }
    return { nightIds, projectIds: Array.from(projectIds) }
  }, [summaries, nights, key])

  return (
    <div className='p-20 h-full overflow-y-auto'>
      <div className='flex items-center gap-12 mb-12'>
        <h2 className='text-lg font-semibold'>Morphospecies: {displayFromKey(key)}</h2>
        <Link to={'/morphospecies'} className='text-sm text-blue-700 hover:underline'>
          Back
        </Link>
      </div>

      <div className='mb-12 text-13 text-neutral-700'>
        <span className='mr-12'>Projects: {usage.projectIds.length}</span>
        <span>Nights: {usage.nightIds.length}</span>
      </div>

      {usage.projectIds.length ? (
        <section className='mb-20'>
          <h3 className='mb-6 text-14 font-semibold'>Projects</h3>
          <ul className='list-disc pl-16 text-13'>
            {usage.projectIds.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {usage.nightIds.length ? (
        <section>
          <h3 className='mb-6 text-14 font-semibold'>Nights</h3>
          <ul className='list-disc pl-16 text-13'>
            {usage.nightIds.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function displayFromKey(key: string) {
  const res = key
  return res
}

export {}
