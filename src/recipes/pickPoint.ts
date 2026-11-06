import type { Five, Intersection } from "@realsee/five";

/** Opt in while a placement tool is active; the returned cleanup restores it. */
export function watchPickedPoint(
  five: Five,
  onPick: (hit: Intersection | null) => void
): () => void {
  return five.on("gesture.tap", (event) => {
    // Prevent this tool's tap from also triggering default point navigation.
    event.preventDefault();
    const hits = five.model.intersectRaycaster(event.center.raycaster);
    onPick(hits[0] ?? null);
  });
}
