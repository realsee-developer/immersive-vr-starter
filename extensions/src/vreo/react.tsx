import { useState } from 'react'
import { createFiveProvider, FiveAutoCanvas } from '@realsee/five/react'
import type { Work } from '@realsee/five'
import { VreoProvider, useVreoAction, useVreoPausedState } from '@realsee/vreo/react'
import type { VreoUnit } from '@realsee/vreo/typings'
import '@realsee/vreo/stylesheets/default.css'

const FiveProvider = createFiveProvider()

function Controls({ unit }: { unit: VreoUnit }) {
  const { load, play, pause } = useVreoAction()
  const paused = useVreoPausedState()
  const [status, setStatus] = useState('Ready to load narrative')
  async function start() {
    setStatus('Loading narrative')
    try {
      if (!await load(unit, 0) || !play(0)) throw new Error('Narrative unavailable')
      setStatus('Playing')
    } catch { setStatus('Narrative unavailable. Check the script and media access.') }
  }
  return <div><button onClick={() => void start()}>Load and replay</button><button onClick={pause} disabled={paused}>Pause</button><p role="status">{status}</p></div>
}

// Keep FiveAutoCanvas outside VreoProvider: that provider mounts children after Player creation.
export function NarrativeScene({ work, unit }: { work: Work; unit: VreoUnit }) {
  return <FiveProvider initialWork={work}>
    <div style={{ width: '100%', height: 480 }}><FiveAutoCanvas /></div>
    <VreoProvider><Controls unit={unit} /></VreoProvider>
  </FiveProvider>
}
