// generates the shadcn registry JSON into public/r/ from registry/ sources
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const BASE = 'https://scraps.ogme01.com/r'
const CORE_URL = `${BASE}/scraps-core.json`

const read = f => readFileSync(new URL(`../registry/${f}`, import.meta.url), 'utf8')

const core = {
  name: 'scraps-core',
  type: 'registry:lib',
  title: 'Scraps core',
  description: 'Shared scrap lifecycle hook and prop bridge into the scraps-ui engine.',
  file: 'scraps-core.ts',
  target: 'lib/scraps-core.ts',
}

const components = [
  { name: 'scrap-button', title: 'Scrap Button', description: 'A button cut from construction paper. Boils on hover; optional rip/fold/glue/shred on click.', file: 'scrap-button.tsx' },
  { name: 'scrap-chip', title: 'Scrap Chip', description: 'A small offcut of paper for badges and labels.', file: 'scrap-chip.tsx' },
  { name: 'scrap-card', title: 'Scrap Card', description: 'A torn sheet of paper, with optional tape. Includes ScrapDivider.', file: 'scrap-card.tsx' },
  { name: 'scrap-field', title: 'Scrap Fields', description: 'Input, textarea, select (with the paper dropdown), and range on paper.', file: 'scrap-field.tsx' },
  { name: 'scrap-choice', title: 'Scrap Choices', description: 'Checkbox, radio, and toggle as paper chips. The X lands differently on every check.', file: 'scrap-choice.tsx' },
  { name: 'scrap-progress', title: 'Scrap Progress', description: 'A torn strip of progress.', file: 'scrap-progress.tsx' },
  { name: 'scrap-dialog', title: 'Scrap Dialog', description: 'A native dialog as a torn sheet taped over a dimmed mat; data-side makes it a sheet.', file: 'scrap-dialog.tsx' },
  { name: 'scrap-menu', title: 'Scrap Menu', description: 'A floating paper menu panel opened by any data-menu trigger.', file: 'scrap-menu.tsx' },
  { name: 'scrap-tabs', title: 'Scrap Tabs', description: 'Folder-tab paper tabs over torn panels.', file: 'scrap-tabs.tsx' },
  { name: 'scrap-accordion', title: 'Scrap Accordion', description: 'Native details/summary on paper that re-tears as it opens.', file: 'scrap-accordion.tsx' },
  { name: 'scrap-table', title: 'Scrap Table', description: 'A real table on ruled paper.', file: 'scrap-table.tsx' },
  { name: 'scrap-avatar', title: 'Scrap Avatar', description: 'An image torn out along a seeded edge with a white fringe.', file: 'scrap-avatar.tsx' },
  { name: 'scrap-feedback', title: 'Scrap Feedback', description: 'Toast (glued to the corner) plus alert and skeleton.', file: 'scrap-feedback.tsx' },
]

const item = (meta, files, registryDependencies) => ({
  $schema: 'https://ui.shadcn.com/schema/registry-item.json',
  name: meta.name,
  type: meta.type ?? 'registry:ui',
  title: meta.title,
  description: meta.description,
  dependencies: ['scraps-ui'],
  ...(registryDependencies?.length ? { registryDependencies } : {}),
  files,
})

mkdirSync('public/r', { recursive: true })

const coreFile = { path: `registry/${core.file}`, content: read(core.file), type: 'registry:lib', target: core.target }
writeFileSync('public/r/scraps-core.json', JSON.stringify(item(core, [coreFile]), null, 2))

for (const c of components) {
  const f = { path: `registry/${c.file}`, content: read(c.file), type: 'registry:ui', target: `components/ui/${c.file}` }
  writeFileSync(`public/r/${c.name}.json`, JSON.stringify(item(c, [f], [CORE_URL]), null, 2))
}

// the everything item: one URL installs the whole drawer
const all = item(
  { name: 'scraps', title: 'Scraps', description: 'Every scraps-ui component: the whole paper drawer in one add.' },
  [coreFile, ...components.map(c => ({ path: `registry/${c.file}`, content: read(c.file), type: 'registry:ui', target: `components/ui/${c.file}` }))]
)
writeFileSync('public/r/scraps.json', JSON.stringify(all, null, 2))

writeFileSync('public/r/registry.json', JSON.stringify({
  $schema: 'https://ui.shadcn.com/schema/registry.json',
  name: 'scraps',
  homepage: 'https://scraps.ogme01.com',
  items: [core, ...components].map(m => ({
    name: m.name,
    type: m.type ?? 'registry:ui',
    title: m.title,
    description: m.description,
    files: [{ path: `registry/${m.file}`, type: m.type ?? 'registry:ui' }],
  })),
}, null, 2))

console.log('registry built:', ['scraps-core', ...components.map(c => c.name), 'scraps', 'registry'].join(', '))
