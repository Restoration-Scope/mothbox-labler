# Commit mode

- Instruction:
  - 1. "look at the past few commits and process pattern of commit messages".
  - 2. Then check the current working dir and figure out how many commits might be necessary and which files are linked to each commit.
  - 3. For each commit come up with a message
  - 4. Finally make the commits
- Format: {context or tenant short name} - {commit message}. E.g. "Core - improve filters", or "Azuero - add new fields", or "Landing - fix copy"

- Undefined/null safety checklist (before committing):
  - Scan changed lines for potentially undefined access. Prefer optional chaining from the root: use `obj?.child?.leaf` and `obj?.[key]` for dynamic keys.
  - Guard config-driven keys and values: verify presence and type before use (e.g., `if (!entityConfig?.urlIdField || typeof entityConfig.urlIdField !== 'string') return`).
  - When reading nested map/libre features, default intermediate objects: `const properties = feature?.properties ?? {}` then read from `properties`.
  - Avoid non-null assertions (`!`). Narrow instead with early returns or type guards.
  - Use nullish coalescing for safe defaults: `const value = maybeNullish ?? fallback`.
  - Double-check dynamic bracket access always uses optional chaining: `source?.[key]` not `source[key]`.
  - Prefer early returns on missing data to reduce nesting and runtime surprises.

- Never push, or create new branches, or PRs without my explicit instruction
