import type { Five as FiveInstance } from "@realsee/five";

export type MountedScene = {
  five: FiveInstance;
  dispose: () => void;
};

/** Browser only. Give host an explicit height before calling this function. */
export async function mountScene(
  host: HTMLElement,
  rawWork: unknown,
  signal?: AbortSignal
): Promise<MountedScene> {
  const { Five, parseWork } = await import("@realsee/five");
  signal?.throwIfAborted();
  const five = new Five({ imageOptions: { size: 512 } });
  const layer = document.createElement("div");
  layer.style.cssText = "width:100%;height:100%";
  host.append(layer);
  let disposed = false;
  const resize = new ResizeObserver(() => five.refresh());
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    signal?.removeEventListener("abort", dispose);
    resize.disconnect();
    five.dispose();
    layer.remove();
  };
  signal?.addEventListener("abort", dispose, { once: true });
  try {
    five.appendTo(layer);
    resize.observe(layer);
    await five.load(parseWork(rawWork), "initial");
    signal?.throwIfAborted();
    five.refresh();
    return { five, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
