import { parseArgs } from 'node:util'
import { createInterface } from 'node:readline/promises'
import { readFile, writeFile } from 'node:fs/promises'
const choices = ['react', 'vue', 'typescript']
const { values } = parseArgs({ options: { framework: { type: 'string' } }, strict: true })
let framework = values.framework
if (!framework) {
  if (!process.stdin.isTTY) throw new Error('Choose a framework: npm run setup -- --framework react|vue|typescript')
  const prompt = createInterface({ input: process.stdin, output: process.stdout })
  try {
    console.log('One immersive VR project. Choose the UI you want to work with.')
    const answer = (await prompt.question('1 React   2 Vue   3 TypeScript (no framework)\nYour choice [1]: ')).trim() || '1'
    framework = ({ 1: 'react', 2: 'vue', 3: 'typescript' })[answer] || answer
  } finally { prompt.close() }
}
if (!choices.includes(framework)) throw new Error('Framework must be react, vue, or typescript. No configuration was changed.')
let current = {}
try { current = JSON.parse(await readFile('.starter.json', 'utf8')) }
catch (error) { if (error.code !== 'ENOENT') throw new Error('The existing .starter.json could not be read. It was not changed.') }
await writeFile('.starter.json', `${JSON.stringify({ ...current, framework }, null, 2)}\n`)
console.log(`Selected ${framework}. Run npm ci, npm run check, then npm run dev.`)
