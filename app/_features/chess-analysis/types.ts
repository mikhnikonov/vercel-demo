import type {
  ChessAnalysisResult,
  ChessAnalysisStatusResponse,
  ChessPosition,
  ChessPositionEvaluation,
  PlayerSide,
} from "@/lib/chess/types";

export type AnalysisProgress = {
  positions: ChessPosition[];
  evaluations: ChessPositionEvaluation[];
  totalPositions?: number;
};

export type BoardSide = PlayerSide;

export type AiTutorPhase =
  | "idle"
  | "preparing-summary"
  | "ai-evaluation"
  | "ready"
  | "error";

export type ChessAnalysisRequestState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | {
      kind: "polling";
      runId: string;
      status: ChessAnalysisStatusResponse["status"];
      progress: AnalysisProgress;
    }
  | {
      kind: "completed";
      runId: string;
      result: ChessAnalysisResult;
    }
  | { kind: "error"; message: string; runId?: string };
