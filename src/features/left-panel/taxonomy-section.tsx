import React from 'react'
import { useStore } from '@nanostores/react'
import { EllipsisIcon } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/dropdown-menu'
import { clearPatchSelection } from '~/stores/ui'
import { LeftPanelHeading } from '~/styles'
import { collapsedKeysStore, collapseMany, expandMany, isExpandedKey, makeKey, toggleKey } from './collapse.store'
import { CountsRow } from './counts-row'
import type { TaxonomyNode } from './left-panel.types'
import { TaxonomyRow } from './taxonomy-row'
import { cn } from '~/styles/classed'

export type TaxonomySectionProps = {
  title: string
  nodes?: TaxonomyNode[]
  bucket: 'auto' | 'user'
  selectedTaxon?: { rank: 'order' | 'family' | 'genus' | 'species'; name: string }
  selectedBucket?: 'auto' | 'user'
  onSelectTaxon: (params: { taxon?: { rank: 'order' | 'family' | 'genus' | 'species'; name: string }; bucket: 'auto' | 'user' }) => void
  emptyText: string
  className?: string
}

export function TaxonomySection(props: TaxonomySectionProps) {
  const { title, nodes, bucket, selectedTaxon, selectedBucket, onSelectTaxon, emptyText, className } = props
  const collapsedSet = useStore(collapsedKeysStore)

  if (!nodes || nodes.length === 0) {
    return (
      <div className={className}>
        <LeftPanelHeading className='mb-6 text-14 font-semibold'>{title}</LeftPanelHeading>
        <p className='text-13 text-neutral-500'>{emptyText}</p>
      </div>
    )
  }

  const allCount = nodes.reduce((acc, n) => acc + (n?.count || 0), 0)
  const isAllSelected = !selectedTaxon && selectedBucket === bucket

  return (
    <div className={className}>
      <SectionHeader title={title} bucket={bucket} nodes={nodes} />

      <div>
        {bucket === 'auto' ? (
          <CountsRow
            label='All unapproved'
            count={allCount}
            selected={isAllSelected}
            onSelect={() => {
              clearPatchSelection()
              onSelectTaxon({ taxon: undefined, bucket })
            }}
          />
        ) : null}

        {nodes.map((orderNode) => (
          <OrderNode
            key={`order-${orderNode.name}`}
            bucket={bucket}
            orderNode={orderNode}
            selectedTaxon={selectedTaxon}
            selectedBucket={selectedBucket}
            onSelectTaxon={onSelectTaxon}
          />
        ))}
      </div>
    </div>
  )
}

function SectionHeader(props: { title: string; bucket: 'auto' | 'user'; nodes: TaxonomyNode[] }) {
  const { title, bucket, nodes } = props
  return (
    <div className='mb-6 flex items-center justify-between'>
      <h4 className='text-14 font-semibold'>{title}</h4>

      <SectionMoreMenu bucket={bucket} nodes={nodes} />
    </div>
  )
}

function SectionMoreMenu(props: { bucket: 'auto' | 'user'; nodes: TaxonomyNode[] }) {
  const { bucket, nodes } = props
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size='icon-sm' variant='ghostMuted' aria-label='Taxonomy actions' icon={EllipsisIcon} />
      </DropdownMenuTrigger>

      <DropdownMenuContent align='end' sideOffset={4}>
        <DropdownMenuItem onSelect={() => expandMany(allKeysFor(nodes, bucket))}>Expand all</DropdownMenuItem>

        <DropdownMenuItem onSelect={() => collapseMany(allKeysFor(nodes, bucket))}>Collapse all</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
function OrderNode(props: {
  bucket: 'auto' | 'user'
  orderNode: TaxonomyNode
  selectedTaxon?: { rank: 'order' | 'family' | 'genus' | 'species'; name: string }
  selectedBucket?: 'auto' | 'user'
  onSelectTaxon: (params: { taxon?: { rank: 'order' | 'family' | 'genus' | 'species'; name: string }; bucket: 'auto' | 'user' }) => void
}) {
  const { bucket, orderNode, selectedTaxon, selectedBucket, onSelectTaxon } = props
  const orderKey = makeKey({ bucket, rank: 'order', path: `${orderNode.name}` })
  const orderExpanded = isExpandedKey(orderKey)
  const hasChildren = !!(orderNode.children && orderNode.children.length)
  return (
    <div>
      <TaxonomyRow
        rank='order'
        name={orderNode.name}
        count={orderNode.count}
        selected={selectedBucket === bucket && selectedTaxon?.rank === 'order' && selectedTaxon?.name === orderNode.name}
        onSelect={() => {
          clearPatchSelection()
          onSelectTaxon({ taxon: { rank: 'order', name: orderNode.name }, bucket })
        }}
        canToggle={hasChildren}
        expanded={orderExpanded}
        onToggleExpanded={() => toggleKey(orderKey)}
      />

      {hasChildren && orderExpanded ? (
        <IndentedBranch>
          {(orderNode.children || []).map((familyNode, index) => (
            <FamilyNode
              key={`family-${orderNode.name}-${familyNode.name}`}
              bucket={bucket}
              orderName={orderNode.name}
              familyNode={familyNode}
              isFirstChild={index === 0}
              selectedTaxon={selectedTaxon}
              selectedBucket={selectedBucket}
              onSelectTaxon={onSelectTaxon}
            />
          ))}
        </IndentedBranch>
      ) : null}
    </div>
  )
}

function FamilyNode(props: {
  bucket: 'auto' | 'user'
  orderName: string
  familyNode: TaxonomyNode
  isFirstChild?: boolean
  selectedTaxon?: { rank: 'order' | 'family' | 'genus' | 'species'; name: string }
  selectedBucket?: 'auto' | 'user'
  onSelectTaxon: (params: { taxon?: { rank: 'order' | 'family' | 'genus' | 'species'; name: string }; bucket: 'auto' | 'user' }) => void
}) {
  const { bucket, orderName, familyNode, isFirstChild, selectedTaxon, selectedBucket, onSelectTaxon } = props
  const familyPath = `${orderName}/${familyNode.name}`
  const familyKey = makeKey({ bucket, rank: 'family', path: familyPath })
  const familyExpanded = isExpandedKey(familyKey)
  const hasChildren = !!(familyNode.children && familyNode.children.length)
  return (
    <div className='relative'>
      <TaxonomyRow
        rank='family'
        name={familyNode.name}
        count={familyNode.count}
        selected={selectedBucket === bucket && selectedTaxon?.rank === 'family' && selectedTaxon?.name === familyNode.name}
        onSelect={() => {
          clearPatchSelection()
          onSelectTaxon({ taxon: { rank: 'family', name: familyNode.name }, bucket })
        }}
        withConnector
        isFirstChild={isFirstChild}
        canToggle={hasChildren}
        expanded={familyExpanded}
        onToggleExpanded={() => toggleKey(familyKey)}
      />

      {hasChildren && familyExpanded ? (
        <IndentedBranch>
          {(familyNode.children || []).map((genusNode, index) => (
            <GenusNode
              key={`genus-${orderName}-${familyNode.name}-${genusNode.name}`}
              bucket={bucket}
              orderName={orderName}
              familyName={familyNode.name}
              genusNode={genusNode}
              isFirstChild={index === 0}
              selectedTaxon={selectedTaxon}
              selectedBucket={selectedBucket}
              onSelectTaxon={onSelectTaxon}
            />
          ))}
        </IndentedBranch>
      ) : null}
    </div>
  )
}

function GenusNode(props: {
  bucket: 'auto' | 'user'
  orderName: string
  familyName: string
  genusNode: TaxonomyNode
  isFirstChild?: boolean
  selectedTaxon?: { rank: 'order' | 'family' | 'genus' | 'species'; name: string }
  selectedBucket?: 'auto' | 'user'
  onSelectTaxon: (params: { taxon?: { rank: 'order' | 'family' | 'genus' | 'species'; name: string }; bucket: 'auto' | 'user' }) => void
}) {
  const { bucket, orderName, familyName, genusNode, isFirstChild, selectedTaxon, selectedBucket, onSelectTaxon } = props
  const genusPath = `${orderName}/${familyName}/${genusNode.name}`
  const genusKey = makeKey({ bucket, rank: 'genus', path: genusPath })
  const genusExpanded = isExpandedKey(genusKey)
  const hasChildren = !!(genusNode.children && genusNode.children.length)
  return (
    <div className='relative'>
      <TaxonomyRow
        rank='genus'
        name={genusNode.name}
        count={genusNode.count}
        selected={selectedBucket === bucket && selectedTaxon?.rank === 'genus' && selectedTaxon?.name === genusNode.name}
        onSelect={() => {
          clearPatchSelection()
          onSelectTaxon({ taxon: { rank: 'genus', name: genusNode.name }, bucket })
        }}
        withConnector
        isFirstChild={isFirstChild}
        canToggle={hasChildren}
        expanded={genusExpanded}
        onToggleExpanded={() => toggleKey(genusKey)}
      />

      {hasChildren && genusExpanded ? (
        <IndentedBranch>
          {(genusNode.children || []).map((speciesNode, index) => (
            <div key={`species-${orderName}-${familyName}-${genusNode.name}-${speciesNode.name}`} className='relative'>
              <TaxonomyRow
                rank='species'
                name={speciesNode.name}
                count={speciesNode.count}
                selected={selectedBucket === bucket && selectedTaxon?.rank === 'species' && selectedTaxon?.name === speciesNode.name}
                onSelect={() => {
                  clearPatchSelection()
                  onSelectTaxon({ taxon: { rank: 'species', name: speciesNode.name }, bucket })
                }}
                withConnector
                isFirstChild={index === 0}
              />
            </div>
          ))}
        </IndentedBranch>
      ) : null}
    </div>
  )
}

function allKeysFor(nodes: TaxonomyNode[], bucket: 'auto' | 'user'): string[] {
  const keys: string[] = []
  for (const orderNode of nodes || []) {
    if (orderNode.children && orderNode.children.length) {
      const orderKey = makeKey({ bucket, rank: 'order', path: orderNode.name })
      keys.push(orderKey)
    }
    for (const familyNode of orderNode.children || []) {
      const familyPath = `${orderNode.name}/${familyNode.name}`
      if (familyNode.children && familyNode.children.length) {
        const familyKey = makeKey({ bucket, rank: 'family', path: familyPath })
        keys.push(familyKey)
      }
      for (const genusNode of familyNode.children || []) {
        const genusPath = `${familyPath}/${genusNode.name}`
        if (genusNode.children && genusNode.children.length) {
          const genusKey = makeKey({ bucket, rank: 'genus', path: genusPath })
          keys.push(genusKey)
        }
      }
    }
  }
  return keys
}

function IndentedBranch(props: { className?: string; children: React.ReactNode }) {
  const { className, children } = props
  const childCount = React.Children.count(children)
  return (
    <div className={cn('relative ml-8 pl-16', className)}>
      {childCount > 1 ? (
        <div className='pointer-events-none absolute left-[1.5px] -top-6 h-[70%] w-1 bg-gradient-to-b from-ink-300 via-ink-200 to-ink-300'></div>
      ) : null}
      {children}
    </div>
  )
}
