import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { StarterError } from "./errors.ts";

const SELECTION_TTL_MS = 5 * 60 * 1000;

// A handle proves that this process listed a VR for the configured Team.
// Restarting the server expires handles; refresh the directory to get new ones.
export function createSelectionStore(teamSource: string, now = Date.now) {
  const secret = randomBytes(32);
  function sign(body: string) {
    return createHmac("sha256", secret).update(body).digest("base64url");
  }
  return {
    issue(resourceCode: string) {
      const body = Buffer.from(
        JSON.stringify({
          resourceCode,
          teamSource,
          expires: now() + SELECTION_TTL_MS,
        })
      ).toString("base64url");
      return `${body}.${sign(body)}`;
    },
    verify(handle: unknown) {
      const invalid = () =>
        new StarterError(
          403,
          "INVALID_SELECTION",
          "selection",
          "Refresh the Team directory and select a VR from the current list."
        );
      if (typeof handle !== "string" || handle.length > 2048) throw invalid();
      const [body, signature, extra] = handle.split(".");
      if (!body || !signature || extra) throw invalid();
      const expected = Buffer.from(sign(body));
      const received = Buffer.from(signature);
      if (
        expected.length !== received.length ||
        !timingSafeEqual(expected, received)
      )
        throw invalid();
      let data: unknown;
      try {
        data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
      } catch {
        throw invalid();
      }
      if (
        !data ||
        typeof data !== "object" ||
        !("resourceCode" in data) ||
        !("teamSource" in data) ||
        !("expires" in data) ||
        typeof data.resourceCode !== "string" ||
        !data.resourceCode ||
        data.teamSource !== teamSource ||
        typeof data.expires !== "number"
      )
        throw invalid();
      if (data.expires <= now()) {
        throw new StarterError(
          410,
          "SELECTION_EXPIRED",
          "selection",
          "This selection expired after five minutes. Refresh the Team directory and select the VR again."
        );
      }
      return data.resourceCode;
    },
  };
}
