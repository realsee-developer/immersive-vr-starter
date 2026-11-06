import type { Five } from "@realsee/five";
import type { Vector3 } from "three";

/** Put overlay over the canvas, with the same dimensions and position. */
export function placeLabel(
  five: Five,
  overlay: HTMLElement,
  position: Vector3,
  text: string
): () => void {
  const label = document.createElement("span");
  label.textContent = text;
  label.style.cssText =
    "position:absolute;pointer-events:none;transform:translate(-50%,-100%);padding:6px 10px;border-radius:6px;background:#fff;color:#102f50";
  overlay.append(label);
  const update = () => {
    const point = five.project2d(position, true);
    label.hidden = point === null;
    if (point) {
      label.style.left = `${point.x}px`;
      label.style.top = `${point.y}px`;
    }
  };
  update();
  const stop = five.on("render", update);
  return () => {
    stop();
    label.remove();
  };
}
