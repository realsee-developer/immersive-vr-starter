import type { Five, Pano, Pose } from "@realsee/five";

/** Five 6.9.2 accepts active OR explicitly loadable observers, not both flags. */
export function listDestinations(five: Five): Pano[] {
  return five.observers
    .filter((observer) => observer.active || observer.loadable)
    .map((observer) => ({
      workCode: observer.work.workCode,
      panoIndex: observer.panoIndex,
    }));
}

export async function goToDestination(five: Five, pano: Pano): Promise<void> {
  await five.moveToPano(pano, { effect: "fade", duration: 500 });
}

/** Angles use radians. This rotates/zooms without changing the panorama. */
export async function lookAt(
  five: Five,
  pose: Pick<Pose, "longitude" | "latitude" | "fov">
): Promise<void> {
  await five.updateCamera(pose, 500);
}
