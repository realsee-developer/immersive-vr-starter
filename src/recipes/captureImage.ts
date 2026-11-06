import type { Five } from "@realsee/five";
import { Vector2 } from "three";

/** Call after load, from an explicit capture action, rather than each frame. */
export async function captureImage(five: Five): Promise<Blob> {
  const size = five.getSize(new Vector2());
  const width = Math.floor(size.x);
  const height = Math.floor(size.y);
  if (width < 1 || height < 1) throw new Error("The canvas has no visible size.");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable.");
  const image = context.createImageData(width, height);
  five.getPixels({
    x: 0,
    y: 0,
    width,
    height,
    pixelRatio: 1,
    flipY: true,
    buffer: image.data,
  });
  context.putImageData(image, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG encoding failed."));
    }, "image/png");
  });
}
