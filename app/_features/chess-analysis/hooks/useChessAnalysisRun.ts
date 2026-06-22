"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  ChessAnalysisStreamResponseEvent,
  ChessAnalysisStatusResponse,
} from "@/lib/chess/types";
import { isFailedChessAnalysisStatus } from "@/lib/chess/workflow-status";
import { getJsonErrorMessage, readJsonBody } from "@/lib/http";
import {
  appendEvaluation,
  appendPosition,
  emptyProgress,
  getActiveRunId,
  getCompletedResult,
  getProgressForState,
} from "../lib/analysis-progress";
import { SAMPLE_PGN } from "../config/constants";
import type { ChessAnalysisRequestState } from "../types";
import {
  consumeWorkflowUpdates,
  readStartErrorMessage,
} from "../lib/workflow-stream";

export function useChessAnalysisRun() {
  const [pgn, setPgn] = useState(SAMPLE_PGN);
  const [requestState, setRequestState] =
    useState<ChessAnalysisRequestState>({ kind: "idle" });
  const activeRunId = getActiveRunId(requestState);
  const result = getCompletedResult(requestState);
  const progress = useMemo(
    () => getProgressForState(requestState),
    [requestState]
  );
  const isBusy =
    requestState.kind === "submitting" || requestState.kind === "polling";

  useEffect(() => {
    if (!activeRunId) {
      return;
    }

    const runId = activeRunId;
    let cancelled = false;

    async function pollRun() {
      try {
        const response = await fetch(
          `/api/chess-analysis?runId=${encodeURIComponent(runId)}`
        );
        const data = await readJsonBody(response);

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setRequestState({
            kind: "error",
            runId,
            message: getJsonErrorMessage(data, "Polling failed."),
          });
          return;
        }

        const statusData = data as ChessAnalysisStatusResponse;

        if (statusData.status === "completed" && statusData.result) {
          setRequestState({
            kind: "completed",
            runId,
            result: statusData.result,
          });
          return;
        }

        if (isFailedChessAnalysisStatus(statusData.status)) {
          setRequestState({
            kind: "error",
            runId,
            message: `Workflow ${statusData.status}.`,
          });
          return;
        }

        setRequestState((current) =>
          toPollingState(current, runId, statusData.status)
        );
      } catch (error) {
        if (!cancelled) {
          setRequestState({
            kind: "error",
            runId,
            message:
              error instanceof Error ? error.message : "Unable to poll workflow.",
          });
        }
      }
    }

    pollRun();
    const interval = window.setInterval(pollRun, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeRunId]);

  const applyStreamEvent = useCallback(
    (streamEvent: ChessAnalysisStreamResponseEvent) => {
      setRequestState((current) =>
        getStateAfterStreamEvent(current, streamEvent)
      );
    },
    []
  );

  const runAnalysis = useCallback(async () => {
    setRequestState({ kind: "submitting" });

    try {
      const response = await fetch("/api/chess-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pgn }),
      });

      if (!response.ok) {
        setRequestState({
          kind: "error",
          message: await readStartErrorMessage(response),
        });
        return;
      }

      if (!response.body) {
        setRequestState({
          kind: "error",
          message: "Unable to read workflow updates.",
        });
        return;
      }

      await consumeWorkflowUpdates(response.body, applyStreamEvent);
    } catch (error) {
      setRequestState({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Unable to start workflow.",
      });
    }
  }, [applyStreamEvent, pgn]);

  return {
    isBusy,
    pgn,
    progress,
    requestState,
    result,
    runAnalysis,
    setPgn,
  };
}

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
): ChessAnalysisStatusResponse["status"] {
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

function getStateAfterStreamEvent(
  state: ChessAnalysisRequestState,
  event: ChessAnalysisStreamResponseEvent
): ChessAnalysisRequestState {
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
  status: ChessAnalysisStatusResponse["status"],
  progress = getCurrentProgress(state, runId)
): ChessAnalysisRequestState {
  return {
    kind: "polling",
    progress,
    runId,
    status,
  };
}
