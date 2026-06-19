import type {
  ChessAnalysisResult,
  ChessPosition,
  ChessPositionEvaluation,
} from "@/lib/chess-analysis-types";
import type {
  AnalysisProgress,
  ChessAnalysisRequestState,
} from "../types";

export function emptyProgress(): AnalysisProgress {
  return { positions: [], evaluations: [] };
}

export function getProgressForState(
  state: ChessAnalysisRequestState
): AnalysisProgress {
  if (state.kind === "completed") {
    return progressFromResult(state.result);
  }

  if (state.kind === "polling") {
    return state.progress;
  }

  return emptyProgress();
}

export function progressFromResult(
  result: ChessAnalysisResult
): AnalysisProgress {
  return {
    positions: result.positions.all,
    evaluations: result.evaluations.items,
    totalPositions: result.positions.count,
  };
}

export function appendPosition(
  progress: AnalysisProgress,
  position: ChessPosition,
  totalPositions: number
): AnalysisProgress {
  const positions = progress.positions.some((item) => item.ply === position.ply)
    ? progress.positions.map((item) =>
        item.ply === position.ply ? position : item
      )
    : [...progress.positions, position];

  return {
    ...progress,
    positions: positions.sort((a, b) => a.ply - b.ply),
    totalPositions,
  };
}

export function appendEvaluation(
  progress: AnalysisProgress,
  item: ChessPositionEvaluation,
  totalPositions: number
): AnalysisProgress {
  const evaluations = progress.evaluations.some(
    (current) => current.position.ply === item.position.ply
  )
    ? progress.evaluations.map((current) =>
        current.position.ply === item.position.ply ? item : current
      )
    : [...progress.evaluations, item];

  return {
    ...progress,
    evaluations: evaluations.sort((a, b) => a.position.ply - b.position.ply),
    totalPositions,
  };
}

export function getActiveRunId(state: ChessAnalysisRequestState) {
  return state.kind === "polling" ? state.runId : undefined;
}

export function getCompletedResult(state: ChessAnalysisRequestState) {
  return state.kind === "completed" ? state.result : null;
}

export function getSourceLabel(
  progress: AnalysisProgress,
  result: ChessAnalysisResult | null
) {
  if (result?.source === "chess-api") {
    return "chess-api.com";
  }

  if (result?.source === "partial") {
    return "Partial";
  }

  if (result?.source === "none") {
    return "Unavailable";
  }

  if (progress.evaluations.length > 0) {
    return `${progress.evaluations.length}/${progress.totalPositions ?? progress.positions.length}`;
  }

  if (progress.positions.length > 0) {
    return "Moves ready";
  }

  return "No result";
}

export function getPositionLabel(position?: ChessPosition) {
  if (!position || position.ply === 0) {
    return "Start";
  }

  return `${position.moveNumber}. ${position.san}`;
}

export function getEvaluationForPosition(
  evaluations: ChessPositionEvaluation[],
  position?: ChessPosition
) {
  if (!position) {
    return undefined;
  }

  return evaluations.find(
    (item) =>
      item.position.ply === position.ply && item.position.fen === position.fen
  );
}

export function clampPositionIndex(index: number, positionCount: number) {
  return Math.min(Math.max(index, 0), Math.max(positionCount - 1, 0));
}

export function formatPercent(value: number | undefined) {
  return typeof value === "number" ? `${value.toFixed(1)}%` : "-";
}
