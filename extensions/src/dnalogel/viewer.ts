import { Five, type Work } from '@realsee/five'
import { CameraMovementPlugin, MeasurePlugin, PanoTagPlugin } from '@realsee/dnalogel'

export async function createSpatialInterface(container: HTMLElement, work: Work) {
  const five = new Five({ plugins: [
    [PanoTagPlugin, 'tags', {}],
    [MeasurePlugin, 'measure', { unit: 'm', precision: 2 }],
    [CameraMovementPlugin, 'camera', {}]
  ] })
  five.appendTo(container, { width: container.clientWidth, height: container.clientHeight })
  const resize = new ResizeObserver(() => five.refresh({ width: container.clientWidth, height: container.clientHeight }))
  resize.observe(container)
  try {
    await five.load(work, 'initial')
    await five.ready()
  } catch (error) {
    resize.disconnect()
    five.dispose()
    throw error
  }
  return {
    five,
    tags: five.plugins.tags as ReturnType<typeof PanoTagPlugin>,
    measure: five.plugins.measure as ReturnType<typeof MeasurePlugin>,
    camera: five.plugins.camera as ReturnType<typeof CameraMovementPlugin>,
    dispose() { resize.disconnect(); five.dispose() }
  }
}
