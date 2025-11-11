import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IdentifyDialog } from '~/features/species-identification/identify-dialog'

describe('IdentifyDialog - manual rank additions', () => {
  it('shows "Add Order" action and submits order taxon', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<IdentifyDialog open={true} onOpenChange={() => {}} onSubmit={onSubmit} projectId={'test-project'} />)

    const input = screen.getByPlaceholderText('Type a label (species, genus, family, ...)')
    await user.type(input, 'Lepidoptera')

    const addOrder = await screen.findByText('Add Order "Lepidoptera"')
    await user.click(addOrder)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const [label, taxon] = onSubmit.mock.calls[0]
    expect(label).toBe('Lepidoptera')
    expect(taxon).toMatchObject({ taxonRank: 'order', order: 'Lepidoptera' })
  })

  it('shows "Add Class" action and submits class taxon', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<IdentifyDialog open={true} onOpenChange={() => {}} onSubmit={onSubmit} projectId={'test-project'} />)

    const input = screen.getByPlaceholderText('Type a label (species, genus, family, ...)')
    await user.type(input, 'Arachnida')

    const addClass = await screen.findByText('Add Class "Arachnida"')
    await user.click(addClass)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const [label, taxon] = onSubmit.mock.calls[0]
    expect(label).toBe('Arachnida')
    expect(taxon).toMatchObject({ taxonRank: 'class', class: 'Arachnida' })
  })

  it('shows "Add morpho species" action and submits morphospecies label without taxon', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<IdentifyDialog open={true} onOpenChange={() => {}} onSubmit={onSubmit} projectId={'test-project'} />)

    const input = screen.getByPlaceholderText('Type a label (species, genus, family, ...)')
    await user.type(input, '111')

    const addMorpho = await screen.findByText('Add morpho species: "111"')
    await user.click(addMorpho)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const [label, taxon] = onSubmit.mock.calls[0]
    expect(label).toBe('111')
    expect(taxon).toBeUndefined()
  })

  it('shows "Add Genus" action and submits genus taxon', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<IdentifyDialog open={true} onOpenChange={() => {}} onSubmit={onSubmit} projectId={'test-project'} />)

    const input = screen.getByPlaceholderText('Type a label (species, genus, family, ...)')
    await user.type(input, 'Olinta')

    const addGenus = await screen.findByText('Add Genus "Olinta"')
    await user.click(addGenus)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const [label, taxon] = onSubmit.mock.calls[0]
    expect(label).toBe('Olinta')
    expect(taxon).toMatchObject({ taxonRank: 'genus', genus: 'Olinta' })
  })

  it('shows "Add Family" action and submits family taxon', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<IdentifyDialog open={true} onOpenChange={() => {}} onSubmit={onSubmit} projectId={'test-project'} />)

    const input = screen.getByPlaceholderText('Type a label (species, genus, family, ...)')
    await user.type(input, 'Muscidae')

    const addFamily = await screen.findByText('Add Family "Muscidae"')
    await user.click(addFamily)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const [label, taxon] = onSubmit.mock.calls[0]
    expect(label).toBe('Muscidae')
    expect(taxon).toMatchObject({ taxonRank: 'family', family: 'Muscidae' })
  })

  it('shows "Add Tribe" action and submits tribe taxon', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<IdentifyDialog open={true} onOpenChange={() => {}} onSubmit={onSubmit} projectId={'test-project'} />)

    const input = screen.getByPlaceholderText('Type a label (species, genus, family, ...)')
    await user.type(input, 'TestTribe')

    const addTribe = await screen.findByText('Add Tribe "TestTribe"')
    await user.click(addTribe)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const [label, taxon] = onSubmit.mock.calls[0]
    expect(label).toBe('TestTribe')
    expect(taxon).toMatchObject({ taxonRank: 'tribe' })
  })

  it('shows "Add Subfamily" action and submits subfamily taxon', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<IdentifyDialog open={true} onOpenChange={() => {}} onSubmit={onSubmit} projectId={'test-project'} />)

    const input = screen.getByPlaceholderText('Type a label (species, genus, family, ...)')
    await user.type(input, 'TestSubfamily')

    const addSubfamily = await screen.findByText('Add Subfamily "TestSubfamily"')
    await user.click(addSubfamily)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const [label, taxon] = onSubmit.mock.calls[0]
    expect(label).toBe('TestSubfamily')
    expect(taxon).toMatchObject({ taxonRank: 'subfamily' })
  })

  it('shows "Add Suborder" action and submits suborder taxon', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<IdentifyDialog open={true} onOpenChange={() => {}} onSubmit={onSubmit} projectId={'test-project'} />)

    const input = screen.getByPlaceholderText('Type a label (species, genus, family, ...)')
    await user.type(input, 'TestSuborder')

    const addSuborder = await screen.findByText('Add Suborder "TestSuborder"')
    await user.click(addSuborder)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const [label, taxon] = onSubmit.mock.calls[0]
    expect(label).toBe('TestSuborder')
    expect(taxon).toMatchObject({ taxonRank: 'suborder' })
  })
})
