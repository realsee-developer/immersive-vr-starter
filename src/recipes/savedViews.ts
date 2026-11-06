import type { Five, State } from "@realsee/five";
import { Vector3 } from "three";

export type SavedView = Omit<State, "offset"> & {
  offset: [number, number, number];
};

/** The returned value is JSON serializable and does not retain live vectors. */
export function saveView(five: Five): SavedView {
  const state = five.getCurrentState();
  return {
    ...state,
    offset: [state.offset.x, state.offset.y, state.offset.z],
  };
}

/** Restore only a trusted snapshot for the same loaded Work. */
export function restoreView(five: Five, view: SavedView): void {
  if (view.workCode !== five.work.workCode)
    throw new Error("Load the snapshot's Work before restoring its view.");
  five.setState({ ...view, offset: new Vector3(...view.offset) }, true);
}
