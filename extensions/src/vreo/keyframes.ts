import { Five } from '@realsee/five'
import { VreoKeyframeEnum, type VreoUnit, type VreoKeyframe, type CameraMovementData, type PrompterData } from '@realsee/vreo/typings'

// Use an accessible media asset, or an empty URL for Vreo's built-in silent timeline.
export function createNarrative(narrationUrl: string, durationMs: number, panoIndex: number, fov = 90): VreoUnit {
  if (!Number.isFinite(durationMs) || durationMs < 4000) throw new Error('Use a timeline at least four seconds long')
  const camera: CameraMovementData = { mode: Five.Mode.Panorama, panoIndex, longitude: 0, latitude: 0, fov }
  const caption: PrompterData = { text: 'Welcome to this space.' }
  const keyframes: VreoKeyframe[] = [
    { type: VreoKeyframeEnum.CameraMovement, start: 0, end: 2000, data: camera },
    { type: VreoKeyframeEnum.Prompter, start: 0, end: 4000, data: caption }
  ]
  return { video: { url: narrationUrl, duration: durationMs, start: 0, end: durationMs }, keyframes }
}
