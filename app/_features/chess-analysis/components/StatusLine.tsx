import type {
  AiTutorPhase,
  AnalysisProgress,
  ChessAnalysisRequestState,
} from "../types";
import { getPositionLabel } from "../lib/analysis-progress";

type StatusLineProps = {
  state: ChessAnalysisRequestState;
  tutorPhase: AiTutorPhase;
};

export function StatusLine({ state, tutorPhase }: StatusLineProps) {
  const progress = getProgressSnapshot(state);
  const status = getPipelineStatus(state, tutorPhase, progress);

  if (state.kind === "error") {
    return (
      <div className="min-w-0 flex-1 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        {state.message}
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-zinc-800">{status.label}</p>
        {progress ? (
          <span className="text-xs font-medium text-zinc-500">
            {progress.completed}/{progress.total} evals
          </span>
        ) : null}
      </div>

      {status.detail ? (
        <p className="mt-1 text-sm text-zinc-600">{status.detail}</p>
      ) : null}

      {progress ? (
        <div className="mt-3">
          <div
            aria-label="Engine evaluation progress"
            aria-valuemax={progress.total}
            aria-valuemin={0}
            aria-valuenow={progress.completed}
            className="h-2 overflow-hidden rounded-full bg-zinc-200"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-emerald-600 transition-[width] duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

type ProgressSnapshot = {
  completed: number;
  detail?: string;
  percent: number;
  total: number;
};

function getProgressSnapshot(
  state: ChessAnalysisRequestState
): ProgressSnapshot | null {
  if (state.kind === "polling") {
    return getProgressFromAnalysisProgress(state.progress);
  }

  if (state.kind === "completed") {
    return getProgressFromAnalysisProgress({
      evaluations: state.result.evaluations.items,
      positions: state.result.positions.all,
      totalPositions: state.result.positions.count,
    });
  }

  return null;
}

function getProgressFromAnalysisProgress(
  progress: AnalysisProgress
): ProgressSnapshot | null {
  const total = progress.totalPositions ?? progress.positions.length;

  if (total <= 0) {
    return null;
  }

  const completed = Math.min(progress.evaluations.length, total);
  const evaluatedPlies = new Set(
    progress.evaluations.map((evaluation) => evaluation.position.ply)
  );
  const nextPosition = progress.positions.find(
    (position) =>
      !evaluatedPlies.has(position.ply)
  );

  return {
    completed,
    detail:
      completed < total
        ? getCurrentEvaluationDetail(nextPosition)
        : "Engine evaluation finished.",
    percent: Math.round((completed / total) * 100),
    total,
  };
}

function getCurrentEvaluationDetail(
  nextPosition: AnalysisProgress["positions"][number] | undefined
) {
  return nextPosition
    ? `Currently evaluating ${getPositionLabel(nextPosition)}`
    : "Waiting for the next position to evaluate.";
}

function getPipelineStatus(
  state: ChessAnalysisRequestState,
  tutorPhase: AiTutorPhase,
  progress: ProgressSnapshot | null
) {
  if (state.kind === "idle") {
    return { label: "Ready to analyze a PGN." };
  }

  if (state.kind === "submitting") {
    return { label: "Preparing engine analysis." };
  }

  if (state.kind === "polling") {
    if (progress && progress.completed >= progress.total) {
      return { label: "Preparing summary." };
    }

    return {
      label: "Engine analysis in progress.",
      detail: progress?.detail,
    };
  }

  if (state.kind === "completed") {
    if (tutorPhase === "preparing-summary") {
      return { label: "Preparing summary for the AI tutor." };
    }

    if (tutorPhase === "ai-evaluation") {
      return { label: "AI evaluation in progress." };
    }

    if (tutorPhase === "ready") {
      return { label: "AI tutor review ready." };
    }

    if (tutorPhase === "error") {
      return { label: "AI tutor review failed." };
    }

    return { label: "Engine analysis complete." };
  }

  return { label: "Analysis failed." };
}
