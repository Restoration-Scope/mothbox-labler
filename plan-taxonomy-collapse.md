### Taxonomy Collapse/Expand Plan

Date: 2025-09-25

## Goal

Add collapse/expand controls to the taxonomy tree in `NightLeftPanel` so each level (order → family → genus → species) can be toggled via an icon control at the left, while keeping the rest of the row clickable for selection.

## Open Questions

1. Which ranks should be collapsible? Order, family, and genus (species has no children), or also allow collapsing the entire section?
2. What should be the default expansion state? e.g., Orders expanded by default, deeper levels collapsed?
3. Should expansion state be tracked per-bucket (`auto` vs `user`) and per-night? Should it persist across page reloads (localStorage), or be in-memory only?
4. Icon orientation preference: use chevron-down when expanded and chevron-up when collapsed (per request), or right/down (conventional)?
5. Toggle hit area size: is a 16–20px square sufficient on the left of the row? Any spacing/offset preferences?
6. When collapsing a parent, should previously toggled states of descendants be remembered and restored when re-expanding?

## Proposed Approach

- UI/UX

  - Add a dedicated toggle control on the left side of each row that has children.
  - Use `@/components/atomic/Icon` with chevron icons to indicate expanded/collapsed.
  - The toggle is its own clickable area; clicking it should not trigger selection (use stopPropagation).
  - The rest of the row remains as-is (click selects/toggles the taxonomy filter).

- State Management

  - Add a small nanostore at `src/features/left-panel/collapse.store.ts` to keep expansion state stable across renders.
  - Keys: `"${bucket}|${rank}:${path}"`, where `path` encodes the full lineage (e.g., `Order`, `Order/Family`, `Order/Family/Genus`).
  - API: `isExpanded(key)`, `toggle(key)`, `expand(key)`, `collapse(key)`, optional `expandAll/collapseAll` (future).
  - Persistence: default in-memory; optionally persist to `localStorage` if requested.

- Component Changes
  - `taxonomy-row.tsx`: accept `canToggle`, `expanded`, and `onToggleExpanded`. Render a left-aligned icon button/area. Maintain current selection behavior for the main row.
  - `taxonomy-section.tsx`: compute path keys per node (by walking the parent lineage), derive `expanded` from store, and conditionally render children.
  - Preserve existing indentation, connector lines, and selection visuals.

## Files Affected

- New: `src/features/left-panel/collapse.store.ts`
- Update: `src/features/left-panel/taxonomy-row.tsx`
- Update: `src/features/left-panel/taxonomy-section.tsx`

## Implementation Checklist

- [ ] Decide defaults and persistence based on answers to Open Questions
- [ ] Create `collapse.store.ts` with helpers and keying scheme
- [ ] Update `taxonomy-row.tsx` to add toggle control and props
- [ ] Update `taxonomy-section.tsx` to use the store, build keys, and hide/show children
- [ ] Verify keyboard/mouse interactions: toggle vs select do not conflict
- [ ] Visual check: spacing, alignment, and hover states match current design
- [ ] Lint and test manually on both Auto and Identified buckets

## Risks & Mitigations

- Interaction conflicts between toggle and selection: mitigate with `stopPropagation` on toggle.
- Key collisions: avoid by including bucket and full lineage in the key.
- Visual regressions in indentation/connector lines: test on all levels and adjust spacing if needed.
