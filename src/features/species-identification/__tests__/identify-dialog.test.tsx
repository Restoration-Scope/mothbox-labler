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
})


