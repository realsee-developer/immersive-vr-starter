import type { Five, Mode } from "@realsee/five";

export type SceneView = Extract<Mode, "Panorama" | "Floorplan" | "Topview">;

/** Await this from a button handler; show a recoverable error on rejection. */
export async function changeView(five: Five, view: SceneView): Promise<void> {
  await five.changeMode(view, undefined, { duration: 500 });
}

/** Subscribe to the completed mode change, and call the returned cleanup. */
export function watchView(
  five: Five,
  onChange: (view: Mode) => void
): () => void {
  onChange(five.currentMode);
  return five.on("mode.change", (event) => onChange(event.mode));
}
