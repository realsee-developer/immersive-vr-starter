import type { Five } from "@realsee/five";

export type LoadingFeedback =
  | { stage: "work"; state: "ready" }
  | { stage: "panorama"; state: "loading"; progress: number }
  | { stage: "panorama"; state: "ready" | "error" }
  | { stage: "model"; state: "ready" | "refined" | "error" };

/** Attach before load. Progress describes an asset, not the entire app/API. */
export function watchLoading(
  five: Five,
  onChange: (value: LoadingFeedback) => void
): () => void {
  const stop = [
    five.on("works.ready", () => onChange({ stage: "work", state: "ready" })),
    five.on("pano.texture.progress", ({ progress }) =>
      onChange({ stage: "panorama", state: "loading", progress })
    ),
    five.on("pano.texture.success", () =>
      onChange({ stage: "panorama", state: "ready" })
    ),
    five.on("pano.texture.error", () =>
      onChange({ stage: "panorama", state: "error" })
    ),
    five.on("models.load", () => onChange({ stage: "model", state: "ready" })),
    five.on("models.refined", () =>
      onChange({ stage: "model", state: "refined" })
    ),
    five.on("model.error", () => onChange({ stage: "model", state: "error" })),
  ];
  return () => stop.forEach((unsubscribe) => unsubscribe());
}
