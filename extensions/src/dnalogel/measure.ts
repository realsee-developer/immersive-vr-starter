import type { MeasurePlugin } from '@realsee/dnalogel'

type MeasureController = ReturnType<typeof MeasurePlugin>

export function bindMeasurement(
  measure: MeasureController,
  report: (result: { reason: string; pointCount: number }) => void
) {
  const stop = measure.on('measureEnd', (reason, points) => report({ reason, pointCount: points.length }))
  return {
    start() { measure.measure() },
    finish() { measure.endMeasure() },
    undo() { measure.undo() },
    cancel() { measure.cancel() },
    metric() { measure.setUnit('m'); measure.setPrecision(2) },
    imperial() { measure.setUnit('ft'); measure.setPrecision(8) },
    clear() { measure.clear() },
    dispose() { stop(); measure.cancel() }
  }
}
