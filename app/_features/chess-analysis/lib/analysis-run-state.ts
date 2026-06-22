import type { ChessAnalysisStreamResponseEvent } from "@/lib/chess/types";
import { isFailedChessAnalysisStatus } from "@/lib/chess/workflow-status";
import type { ChessAnalysisRequestState } from "../types";
import {
  appendEvaluation,
  appendPosition,
  emptyProgress,
} from "./analysis-progress";

function getCurrentProgress(
  state: ChessAnalysisRequestState,
  runId: string
) {
  return state.kind === "polling" && state.runId === runId
    ? state.progress
    : emptyProgress();
}

function getCurrentStatus(
  state: ChessAnalysisRequestState,
  runId: string
) {
  return state.kind === "polling" && state.runId === runId
    ? state.status
    : "running";
}

function isCurrentCompletedRun(
  state: ChessAnalysisRequestState,
  runId: string
) {
  return state.kind === "completed" && state.runId === runId;
}

export function getStateAfterStreamEvent(
  state: ChessAnalysisRequestState,
  event: ChessAnalysisStreamResponseEvent
): ChessAnalysisRequestState {
  // Once polling has installed the final result, stale stream events should be
  // ignored so the UI never regresses from completed back to polling.
  if (event.runId && isCurrentCompletedRun(state, event.runId)) {
    return state;
  }

  if (event.type === "error") {
    return {
      kind: "error",
      message: event.message,
      runId: event.runId,
    };
  }

  if (event.type === "started") {
    return toPollingState(state, event.runId, event.status);
  }

  if (event.type === "status") {
    return isFailedChessAnalysisStatus(event.status)
      ? {
          kind: "error",
          message: `Workflow ${event.status}.`,
          runId: event.runId,
        }
      : toPollingState(state, event.runId, event.status);
  }

  if (event.type === "position") {
    return toPollingState(
      state,
      event.runId,
      getCurrentStatus(state, event.runId),
      appendPosition(
        getCurrentProgress(state, event.runId),
        event.position,
        event.totalPositions
      )
    );
  }

  return toPollingState(
    state,
    event.runId,
    getCurrentStatus(state, event.runId),
    appendEvaluation(
      getCurrentProgress(state, event.runId),
      event.item,
      event.totalPositions
    )
  );
}

function toPollingState(
  state: ChessAnalysisRequestState,
  runId: string,
  status: ReturnType<typeof getCurrentStatus>,
  progress = getCurrentProgress(state, runId)
): ChessAnalysisRequestState {
  // Preserve accumulated progress for the same run; reset only when a new run
  // id appears so old streamed positions cannot leak across analyses.
  return {
    kind: "polling",
    progress,
    runId,
    status,
  };
}
