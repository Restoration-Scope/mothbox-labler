import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock the global dialog system BEFORE importing IdentifyDialog
let mockDialogParams: { component: any; props?: any } | null = null

vi.mock('~/components/dialogs/global-dialog', () => ({
  openGlobalDialog: vi.fn((params: { component: any; props?: any }) => {
    mockDialogParams = params
  }),
  closeGlobalDialog: vi.fn(() => {
    mockDialogParams = null
  }),
}))

// Mock nanostores
vi.mock('@nanostores/react', () => ({
  useStore: vi.fn((store: any) => {
    if (store?.get) {
      return store.get()
    }
    return {}
  }),
}))

// Mock detections store
vi.mock('~/stores/entities/detections', () => ({
  detectionsStore: {
    get: vi.fn(() => ({})),
    set: vi.fn(),
  },
}))

vi.mock('~/stores/species/project-species-list', () => ({
  projectSpeciesSelectionStore: {
    get: vi.fn(() => ({})),
  },
}))

// Import after mocks
import { IdentifyDialog } from '~/features/data-flow/2.identify/identify-dialog'
import { detectionsStore } from '~/stores/entities/detections'

describe('IdentifyDialog - manual rank additions', () => {
  beforeEach(() => {
    mockDialogParams = null
    vi.mocked(detectionsStore.get).mockReturnValue({})
    vi.clearAllMocks()
  })
  it('shows "Add Order" action and submits order taxon', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<IdentifyDialog open={true} onOpenChange={() => {}} onSubmit={onSubmit} projectId={'test-project'} />)

    const input = screen.getByPlaceholderText('Type a label (species, genus, family, ...)')
    await user.type(input, 'Lepidoptera')

    const addOrder = await screen.findByText('Add Order "Lepidoptera"')
    // CommandItem onSelect is triggered by Enter key, not click
    addOrder.focus()
    await user.keyboard('{Enter}')

    // Wait for taxon key dialog to open and simulate confirming with a taxon ID
    await waitFor(() => {
      expect(mockDialogParams).toBeTruthy()
    }, { timeout: 2000 })

    // Extract and call the onConfirm callback from the dialog props
    const dialogProps = mockDialogParams?.props
    const onConfirm = dialogProps?.onConfirm
    expect(onConfirm).toBeTruthy()
    expect(typeof onConfirm).toBe('function')
    
    // Simulate confirming the taxon key dialog
    onConfirm('12345')

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
    }, { timeout: 2000 })

    const [label, taxon] = onSubmit.mock.calls[0]
    expect(label).toBe('Lepidoptera')
    expect(taxon).toMatchObject({ taxonRank: 'order', order: 'Lepidoptera', taxonID: '12345' })
  })

  it('shows "Add Class" action and submits class taxon', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<IdentifyDialog open={true} onOpenChange={() => {}} onSubmit={onSubmit} projectId={'test-project'} />)

    const input = screen.getByPlaceholderText('Type a label (species, genus, family, ...)')
    await user.type(input, 'Arachnida')

    const addClass = await screen.findByText('Add Class "Arachnida"')
    addClass.focus()
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(mockDialogParams).toBeTruthy()
    }, { timeout: 2000 })

    const onConfirm = mockDialogParams?.props?.onConfirm
    expect(onConfirm).toBeTruthy()
    expect(typeof onConfirm).toBe('function')
    onConfirm('67890')

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
    }, { timeout: 2000 })

    const [label, taxon] = onSubmit.mock.calls[0]
    expect(label).toBe('Arachnida')
    expect(taxon).toMatchObject({ taxonRank: 'class', class: 'Arachnida', taxonID: '67890' })
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
    addGenus.focus()
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(mockDialogParams).toBeTruthy()
    }, { timeout: 2000 })

    const onConfirm = mockDialogParams?.props?.onConfirm
    expect(onConfirm).toBeTruthy()
    expect(typeof onConfirm).toBe('function')
    onConfirm('11111')

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
    }, { timeout: 2000 })

    const [label, taxon] = onSubmit.mock.calls[0]
    expect(label).toBe('Olinta')
    expect(taxon).toMatchObject({ taxonRank: 'genus', genus: 'Olinta', taxonID: '11111' })
  })

  it('shows "Add Family" action and submits family taxon', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<IdentifyDialog open={true} onOpenChange={() => {}} onSubmit={onSubmit} projectId={'test-project'} />)

    const input = screen.getByPlaceholderText('Type a label (species, genus, family, ...)')
    await user.type(input, 'Muscidae')

    const addFamily = await screen.findByText('Add Family "Muscidae"')
    addFamily.focus()
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(mockDialogParams).toBeTruthy()
    }, { timeout: 2000 })

    const onConfirm = mockDialogParams?.props?.onConfirm
    expect(onConfirm).toBeTruthy()
    expect(typeof onConfirm).toBe('function')
    onConfirm('22222')

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
    }, { timeout: 2000 })

    const [label, taxon] = onSubmit.mock.calls[0]
    expect(label).toBe('Muscidae')
    expect(taxon).toMatchObject({ taxonRank: 'family', family: 'Muscidae', taxonID: '22222' })
  })

  it('shows "Add Tribe" action and submits tribe taxon', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    // Mock detections store to return a detection with family
    vi.mocked(detectionsStore.get).mockReturnValue({
      'test-detection': {
        id: 'test-detection',
        taxon: { family: 'TestFamily' },
      },
    } as any)

    render(
      <IdentifyDialog
        open={true}
        onOpenChange={() => {}}
        onSubmit={onSubmit}
        projectId={'test-project'}
        detectionIds={['test-detection']}
      />,
    )

    const input = screen.getByPlaceholderText('Type a label (species, genus, family, ...)')
    await user.type(input, 'TestTribe')

    const addTribe = await screen.findByText('Add Tribe "TestTribe"')
    await user.click(addTribe)

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    const [label, taxon] = onSubmit.mock.calls[0]
    expect(label).toBe('TestTribe')
    expect(taxon).toMatchObject({ taxonRank: 'tribe' })
  })

  it('shows "Add Subfamily" action and submits subfamily taxon', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    vi.mocked(detectionsStore.get).mockReturnValue({
      'test-detection': {
        id: 'test-detection',
        taxon: { family: 'TestFamily' },
      },
    } as any)

    render(
      <IdentifyDialog
        open={true}
        onOpenChange={() => {}}
        onSubmit={onSubmit}
        projectId={'test-project'}
        detectionIds={['test-detection']}
      />,
    )

    const input = screen.getByPlaceholderText('Type a label (species, genus, family, ...)')
    await user.type(input, 'TestSubfamily')

    const addSubfamily = await screen.findByText('Add Subfamily "TestSubfamily"')
    await user.click(addSubfamily)

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    const [label, taxon] = onSubmit.mock.calls[0]
    expect(label).toBe('TestSubfamily')
    expect(taxon).toMatchObject({ taxonRank: 'subfamily' })
  })

  it('shows "Add Suborder" action and submits suborder taxon', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    vi.mocked(detectionsStore.get).mockReturnValue({
      'test-detection': {
        id: 'test-detection',
        taxon: { order: 'Diptera' },
      },
    } as any)

    render(
      <IdentifyDialog
        open={true}
        onOpenChange={() => {}}
        onSubmit={onSubmit}
        projectId={'test-project'}
        detectionIds={['test-detection']}
      />,
    )

    const input = screen.getByPlaceholderText('Type a label (species, genus, family, ...)')
    await user.type(input, 'TestSuborder')

    const addSuborder = await screen.findByText('Add Suborder "TestSuborder"')
    await user.click(addSuborder)

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    const [label, taxon] = onSubmit.mock.calls[0]
    expect(label).toBe('TestSuborder')
    expect(taxon).toMatchObject({ taxonRank: 'suborder' })
  })
})
