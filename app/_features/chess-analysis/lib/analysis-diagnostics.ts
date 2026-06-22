import type { ChessPositionEvaluation } from "@/lib/chess/types";
import type { AnalysisProgress } from "../types";
import { getPositionLabel } from "./analysis-progress";

export type EngineFailure = {
  label: string;
  message: string;
  status?: number;
};

export type AnalysisDiagnostics = {
  availableEvaluationCount: number;
  engineFailures: EngineFailure[];
  failedEvaluationCount: number;
  totalPositions: number;
};

export function getAnalysisDiagnostics(
  progress: AnalysisProgress
): AnalysisDiagnostics {
  // Unavailable engine responses are not fatal for the workflow, but they need
  // to become visible diagnostics so the user understands partial tutor output.
  const totalPositions = progress.totalPositions ?? progress.positions.length;
  const engineFailures = progress.evaluations
    .filter((item) => !item.evaluation.available)
    .map(toEngineFailure);

  return {
    availableEvaluationCount: progress.evaluations.length - engineFailures.length,
    engineFailures,
    failedEvaluationCount: engineFailures.length,
    totalPositions,
  };
}

export function getEngineFailureMessage(diagnostics: AnalysisDiagnostics) {
  const firstFailure = diagnostics.engineFailures[0];

  if (!firstFailure) {
    return null;
  }

  const totalText =
    diagnostics.totalPositions > 0
      ? ` of ${diagnostics.totalPositions}`
      : "";

  // Show the first concrete provider error, then explain that adjacent evals
  // still allow the tutor to classify some moves.
  return [
    `chess-api.com did not evaluate ${diagnostics.failedEvaluationCount}${totalText} positions.`,
    `First failure: ${firstFailure.label} - ${firstFailure.message}`,
    "The tutor can still review moves that have adjacent engine evaluations.",
  ].join(" ");
}

function toEngineFailure(item: ChessPositionEvaluation): EngineFailure {
  const statusText = item.evaluation.status
    ? `HTTP ${item.evaluation.status}: `
    : "";

  return {
    label: getPositionLabel(item.position),
    message: `${statusText}${item.evaluation.error ?? "No engine evaluation returned."}`,
    status: item.evaluation.status,
  };
}
