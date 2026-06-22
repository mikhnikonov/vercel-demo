import type {
  AiTutorPhase,
  AnalysisProgress,
  ChessAnalysisRequestState,
} from "../../types";
import { getPositionLabel } from "../../lib/analysis-progress";
import { useChessAnalysis } from "../../state/ChessAnalysisProvider";

export function StatusLine() {
  const { requestState, tutorPhase } = useChessAnalysis();
  const progress = getPipelineProgress(requestState, tutorPhase);
  const status = getPipelineStatus(requestState, tutorPhase, progress);

  if (requestState.kind === "error") {
    return (
      <div className="min-w-0 flex-1 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        {requestState.message}
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-zinc-800">{status.label}</p>
        {progress ? (
          <span className="text-xs font-medium text-zinc-500">
            {progress.summary}
          </span>
        ) : null}
      </div>

      {status.detail ? (
        <p className="mt-1 text-sm text-zinc-600">{status.detail}</p>
      ) : null}

      {progress ? (
        <div className="mt-3">
          <div
            aria-label={progress.ariaLabel}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progress.percent}
            aria-valuetext={progress.ariaValueText}
            className="h-2 overflow-hidden rounded-full bg-zinc-200"
            role="progressbar"
          >
            <div
              className={getProgressBarClassName(progress)}
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

type ProgressSnapshot = {
  ariaLabel: string;
  ariaValueText: string;
  detail?: string;
  isLoading?: boolean;
  percent: number;
  summary: string;
  tone: "active" | "complete" | "error";
};

type EngineProgressSnapshot = {
  completed: number;
  detail?: string;
  total: number;
};

const ENGINE_PROGRESS_PERCENT = 75;
const SUMMARY_PROGRESS_PERCENT = 82;
const AI_PROGRESS_PERCENT = 90;

function getPipelineProgress(
  state: ChessAnalysisRequestState,
  tutorPhase: AiTutorPhase
): ProgressSnapshot | null {
  if (state.kind === "submitting") {
    return {
      ariaLabel: "Chess tutor pipeline progress",
      ariaValueText: "Starting engine analysis",
      detail: "Submitting PGN to the analysis workflow.",
      isLoading: true,
      percent: 5,
      summary: "Starting",
      tone: "active",
    };
  }

  if (state.kind === "polling") {
    const engineProgress = getEngineProgressFromAnalysisProgress(
      state.progress
    );

    if (!engineProgress) {
      return {
        ariaLabel: "Chess tutor pipeline progress",
        ariaValueText: "Waiting for engine positions",
        detail: "Waiting for the first position to evaluate.",
        isLoading: true,
        percent: 5,
        summary: "Waiting",
        tone: "active",
      };
    }

    return {
      ariaLabel: "Chess tutor pipeline progress",
      ariaValueText: `${engineProgress.completed} of ${engineProgress.total} engine evaluations complete`,
      detail: engineProgress.detail,
      isLoading: true,
      percent: Math.min(
        ENGINE_PROGRESS_PERCENT,
        Math.round(
          (engineProgress.completed / engineProgress.total) *
            ENGINE_PROGRESS_PERCENT
        )
      ),
      summary: `${engineProgress.completed}/${engineProgress.total} evals`,
      tone: "active",
    };
  }

  if (state.kind === "completed") {
    const engineProgress = getEngineProgressFromAnalysisProgress({
      evaluations: state.result.evaluations.items,
      positions: state.result.positions.all,
      totalPositions: state.result.positions.count,
    });

    if (tutorPhase === "ready") {
      return {
        ariaLabel: "Chess tutor pipeline progress",
        ariaValueText: "Engine analysis and AI tutor review complete",
        detail: "Engine analysis and AI tutor review complete.",
        percent: 100,
        summary: "Complete",
        tone: "complete",
      };
    }

    if (tutorPhase === "error") {
      return {
        ariaLabel: "Chess tutor pipeline progress",
        ariaValueText: "AI tutor review failed",
        detail: "Engine analysis finished, but the AI tutor review failed.",
        percent: AI_PROGRESS_PERCENT,
        summary: "Tutor failed",
        tone: "error",
      };
    }

    if (tutorPhase === "ai-evaluation") {
      return {
        ariaLabel: "Chess tutor pipeline progress",
        ariaValueText: "AI tutor review is streaming",
        detail: "Streaming the AI tutor review.",
        isLoading: true,
        percent: AI_PROGRESS_PERCENT,
        summary: "AI tutor",
        tone: "active",
      };
    }

    return {
      ariaLabel: "Chess tutor pipeline progress",
      ariaValueText: "Preparing AI tutor review",
      detail:
        engineProgress?.detail === "Engine evaluation finished."
          ? "Preparing the AI tutor summary."
          : engineProgress?.detail,
      isLoading: true,
      percent: SUMMARY_PROGRESS_PERCENT,
      summary: "Summary",
      tone: "active",
    };
  }

  return null;
}

function getEngineProgressFromAnalysisProgress(
  progress: AnalysisProgress
): EngineProgressSnapshot | null {
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
    return {
      label: "Preparing engine analysis.",
      detail: progress?.detail,
    };
  }

  if (state.kind === "polling") {
    return {
      label: "Engine analysis in progress.",
      detail: progress?.detail,
    };
  }

  if (state.kind === "completed") {
    if (tutorPhase === "preparing-summary") {
      return {
        label: "Preparing summary for the AI tutor.",
        detail: progress?.detail,
      };
    }

    if (tutorPhase === "ai-evaluation") {
      return {
        label: "AI evaluation in progress.",
        detail: progress?.detail,
      };
    }

    if (tutorPhase === "ready") {
      return {
        label: "AI tutor review ready.",
        detail: progress?.detail,
      };
    }

    if (tutorPhase === "error") {
      return {
        label: "AI tutor review failed.",
        detail: progress?.detail,
      };
    }

    return {
      label: "Engine analysis complete.",
      detail: progress?.detail,
    };
  }

  return { label: "Analysis failed." };
}

function getProgressBarClassName(progress: ProgressSnapshot) {
  const toneClassName =
    progress.tone === "error" ? "bg-red-600" : "bg-emerald-600";
  const loadingClassName = progress.isLoading
    ? " motion-safe:animate-pulse"
    : "";

  return `h-full rounded-full ${toneClassName} transition-[width] duration-500${loadingClassName}`;
}
