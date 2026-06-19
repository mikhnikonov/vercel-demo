export type ChessPosition = {
  ply: number;
  moveNumber: number;
  san: string;
  lan: string;
  fen: string;
  sideToMove: "w" | "b";
};

export type ChessApiEvaluation = {
  available: boolean;
  status?: number;
  error?: string;
  text?: string;
  fen?: string;
  eval?: number;
  centipawns?: string;
  mate?: number | null;
  move?: string;
  san?: string;
  lan?: string;
  depth?: number;
  winChance?: number;
  continuationArr?: string[];
  raw?: unknown;
};

export type ChessPositionEvaluation = {
  position: ChessPosition;
  evaluation: ChessApiEvaluation;
};

export type ChessAnalysisResult = {
  source: "chess-api" | "partial" | "none";
  positions: {
    count: number;
    final: ChessPosition;
    all: ChessPosition[];
  };
  evaluations: {
    count: number;
    availableCount: number;
    items: ChessPositionEvaluation[];
  };
};

export const CHESS_ANALYSIS_STREAM_NAMESPACE = "client-updates";

export type ChessAnalysisStatusResponse = {
  runId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  result?: ChessAnalysisResult;
};

export type ChessAnalysisWorkflowStreamEvent =
  | {
      type: "position";
      position: ChessPosition;
      totalPositions: number;
    }
  | {
      type: "evaluation";
      item: ChessPositionEvaluation;
      evaluatedCount: number;
      totalPositions: number;
    };

export type ChessAnalysisStreamResponseEvent =
  | {
      type: "started";
      runId: string;
      status: ChessAnalysisStatusResponse["status"];
    }
  | {
      type: "status";
      runId: string;
      status: ChessAnalysisStatusResponse["status"];
    }
  | (ChessAnalysisWorkflowStreamEvent & { runId: string })
  | {
      type: "error";
      runId?: string;
      message: string;
    };
