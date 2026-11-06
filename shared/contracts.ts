export type Mode = "demo" | "team";
export type DiagnosticStage =
  | "configuration"
  | "token"
  | "directory"
  | "selection"
  | "work"
  | "request";
export interface StarterConfig {
  mode: Mode;
  teamConfigured: boolean;
}
export interface TeamVr {
  resourceCode: string;
  name: string;
  sceneHandle: string;
}
export interface TeamDirectory {
  list: TeamVr[];
  page: number;
  pageSize: number;
  total: number | null;
  totalPages: number | null;
}
export interface PublicError {
  code: string;
  stage: DiagnosticStage;
  message: string;
}
export type Envelope<T> = { data: T } | { error: PublicError };
