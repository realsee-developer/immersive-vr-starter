import type { DiagnosticStage, PublicError } from "../shared/contracts.ts";

export class StarterError extends Error {
  readonly status: number;
  readonly publicError: PublicError;
  constructor(
    status: number,
    code: string,
    stage: DiagnosticStage,
    message: string
  ) {
    super(code);
    this.status = status;
    this.publicError = { code, stage, message };
  }
}

export function unavailable(stage: DiagnosticStage) {
  return new StarterError(
    502,
    "GATEWAY_UNAVAILABLE",
    stage,
    `The ${stage} request failed. Check your gateway, credentials, and Team access in the local .env file.`
  );
}
