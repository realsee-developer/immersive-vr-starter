import { parseWork } from '@realsee/five'
import { Vector3 } from 'three'
import workData from '@realsee/open-works/virtual/816lPVZQkQDF5XOpPo/work.json'
import { createSpatialInterface } from './dnalogel/viewer'
import { addTextHotspot } from './dnalogel/tags'
import { bindMeasurement } from './dnalogel/measure'
import { createNarrative } from './vreo/keyframes'
import { startNarrative } from './vreo/player'
import { bindNarrativeControls } from './vreo/controls'
import './demo.css'

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id)
  if (!value) throw new Error(`Missing demo element: ${id}`)
  return value as T
}
const button = (id: string) => element<HTMLButtonElement>(id)
const report = (id: string, text: string) => { element(id).textContent = text }
const allButtons = [...document.querySelectorAll<HTMLButtonElement>('button')]
let spatial: Awaited<ReturnType<typeof createSpatialInterface>> | undefined
let removeTag: (() => void) | undefined
let measurement: ReturnType<typeof bindMeasurement> | undefined
let narrative: ReturnType<typeof bindNarrativeControls> | undefined
let animationFrame = 0
let feet = false

async function load() {
  try {
    spatial = await createSpatialInterface(element('viewer'), parseWork(workData))
    allButtons.forEach((control) => { control.disabled = false })
    for (const id of ['remove-tag', 'narrative-pause', 'narrative-resume', 'narrative-stop']) button(id).disabled = true
    measurement = bindMeasurement(spatial.measure, ({ reason, pointCount }) => report('measure-status', `Measurement ended: ${reason}; ${pointCount} selected points.`))
    report('scene-status', `Scene ready · Five SDK 6.9.2 · ${spatial.five.observers.length} viewpoints`)
    report('tag-status', 'Ready to add a hotspot.')
    report('measure-status', 'Ready. Select Start measurement, then points in the scene.')
    report('narrative-status', 'Ready. The silent story uses Vreo 2.6.4.')
  } catch {
    report('scene-status', 'Scene could not load. Check WebGL and network access to the public assets, then reload.')
  }
}

button('add-tag').addEventListener('click', () => {
  if (!spatial) return
  const instance = spatial
  button('add-tag').disabled = true
  removeTag?.()
  removeTag = undefined
  const position = instance.five.camera.getWorldPosition(new Vector3())
    .add(instance.five.camera.getDirection(new Vector3()).multiplyScalar(2))
  void addTextHotspot(instance.tags, [position.x, position.y, position.z]).then((cleanup) => {
    removeTag = cleanup
    button('remove-tag').disabled = false
    report('tag-status', 'Hotspot added. Click Welcome in the scene to expand it.')
  }).catch(() => report('tag-status', 'The hotspot could not load.')).finally(() => { button('add-tag').disabled = false })
})
button('remove-tag').addEventListener('click', () => {
  removeTag?.(); removeTag = undefined
  button('remove-tag').disabled = true
  report('tag-status', 'Hotspot removed.')
})
button('measure-start').addEventListener('click', () => {
  narrative?.pause()
  measurement?.start()
  report('measure-status', 'Measuring. Select two or more points, then Finish or Enter.')
})
button('measure-end').addEventListener('click', () => measurement?.finish())
button('measure-undo').addEventListener('click', () => measurement?.undo())
button('measure-clear').addEventListener('click', () => { measurement?.clear(); report('measure-status', 'Measurements cleared.') })
button('measure-units').addEventListener('click', () => {
  feet = !feet
  if (feet) measurement?.imperial(); else measurement?.metric()
  button('measure-units').textContent = feet ? 'Use metres' : 'Use feet'
  report('measure-status', feet ? 'Length units: feet and eighth-inches.' : 'Length units: metres with two decimal places.')
})

button('narrative-start').addEventListener('click', () => {
  if (!spatial) return
  const instance = spatial
  measurement?.cancel()
  narrative?.dispose(); narrative = undefined
  cancelAnimationFrame(animationFrame)
  button('narrative-start').disabled = true
  report('narrative-status', 'Loading the silent camera-and-caption story…')
  const unit = createNarrative('', 8000, instance.five.panoIndex, instance.five.state.fov)
  void startNarrative(instance.five, unit, element('narrative-ui')).then((player) => {
    narrative = bindNarrativeControls(player, (state) => report('narrative-status', `Narrative: ${state}.`))
    for (const id of ['narrative-pause', 'narrative-resume', 'narrative-stop']) button(id).disabled = false
    report('narrative-status', 'Narrative playing. Watch the camera and the Welcome caption; no audio is expected.')
    const update = () => {
      report('narrative-time', `${(player.getCurrentTime() / 1000).toFixed(1)} s`)
      animationFrame = requestAnimationFrame(update)
    }
    update()
  }).catch(() => report('narrative-status', 'Narrative did not start. Check the browser console for SDK/media errors.'))
    .finally(() => { button('narrative-start').disabled = false })
})
button('narrative-pause').addEventListener('click', () => narrative?.pause())
button('narrative-resume').addEventListener('click', () => {
  if (!narrative?.resume()) report('narrative-status', 'Narrative did not resume.')
})
button('narrative-stop').addEventListener('click', () => {
  narrative?.dispose(); narrative = undefined
  cancelAnimationFrame(animationFrame)
  for (const id of ['narrative-pause', 'narrative-resume', 'narrative-stop']) button(id).disabled = true
  report('narrative-status', 'Narrative stopped and disposed.')
})
window.addEventListener('pagehide', () => {
  cancelAnimationFrame(animationFrame)
  narrative?.dispose()
  removeTag?.()
  measurement?.dispose()
  spatial?.dispose()
}, { once: true })
void load()
