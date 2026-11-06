import { Five } from '@realsee/five'
import type { CameraMovementPlugin } from '@realsee/dnalogel'

type CameraController = ReturnType<typeof CameraMovementPlugin>

export async function moveAndLook(five: Five, camera: CameraController, panoIndex: number) {
  const moved = await camera.move({ mode: Five.Mode.Panorama, panoIndex }, 1200, { preload: true })
  if (!moved) return false
  return camera.rotate({ panoIndex, longitude: Math.PI / 2, latitude: 0, fov: five.state.fov }, 1000)
}
