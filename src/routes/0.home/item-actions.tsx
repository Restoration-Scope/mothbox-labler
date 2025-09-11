import { Button } from '~/components/ui/button'
import { toast } from 'sonner'
import type { NightEntity } from '~/stores/entities/4.nights'
import { exportScopeDarwinCSV, exportScopeRS } from './item-actions-helpers'

export type ItemActionsProps = { scope: 'project' | 'site' | 'deployment' | 'night'; id: string; nights: Record<string, NightEntity> }

export function ItemActions(props: ItemActionsProps) {
  const { scope, id, nights } = props

  return (
    <div
      className={
        scope === 'project'
          ? 'opacity-0 group/project-hover:opacity-100 transition-opacity flex items-center gap-6'
          : scope === 'site'
          ? 'opacity-0 group/site-hover:opacity-100 transition-opacity flex items-center gap-6'
          : scope === 'deployment'
          ? 'opacity-0 group/deployment-hover:opacity-100 transition-opacity flex items-center gap-6'
          : 'opacity-0 group/night-hover:opacity-100 transition-opacity flex items-center gap-6'
      }
    >
      <Button
        size='sm'
        variant='outline'
        onClick={() => {
          const p = exportScopeDarwinCSV({ scope, id, nights })
          toast.promise(p, { loading: '💾 Exporting DwC…', success: '✅ DwC exported', error: '🚨 Failed to export DwC' })
        }}
      >
        Export DwC
      </Button>
      <Button
        size='sm'
        variant='outline'
        onClick={() => {
          const p = exportScopeRS({ scope, id, nights })
          toast.promise(p, { loading: '💾 Exporting RS…', success: '✅ RS exported', error: '🚨 Failed to export RS' })
        }}
      >
        Export RS
      </Button>
    </div>
  )
}

export {}
