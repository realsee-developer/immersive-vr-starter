import type { Five } from '@realsee/five'
import { Player } from '@realsee/vreo'
import type { VreoUnit } from '@realsee/vreo/typings'
import '@realsee/vreo/stylesheets/default.css'

// Call from a browser UI action, with an already loaded Five scene and a real script.
export async function startNarrative(five: Five, unit: VreoUnit, container: HTMLElement) {
  const player = new Player(five, { container, autoPreload: false })
  try {
    const loaded = await player.load(unit, 0, false, false, true)
    if (!loaded) throw new Error('Narrative did not load')
    if (!player.play(0, true)) throw new Error('Narrative did not start')
    return player
  } catch (error) {
    player.dispose()
    throw error
  }
}
