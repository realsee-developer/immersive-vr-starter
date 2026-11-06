import type { Player } from '@realsee/vreo'
import type { VreoUnit } from '@realsee/vreo/typings'

export function bindNarrativeControls(player: Player, report: (status: string) => void) {
  const stops = [
    player.on('loaded', () => report('loaded')),
    player.on('playing', () => report('playing')),
    player.on('paused', (ended) => report(ended ? 'ended' : 'paused'))
  ]
  return {
    pause() { player.pause() },
    resume() { return player.play(player.getCurrentTime(), true) },
    // In 2.6.4 play(0) does not seek; load resets the timeline and keyframes, then starts playback.
    async replay(unit: VreoUnit) { return player.load(unit, 0, false, true, true) },
    hide() { player.hide() },
    show() { player.show() },
    dispose() { stops.forEach((stop) => stop()); player.dispose() }
  }
}
