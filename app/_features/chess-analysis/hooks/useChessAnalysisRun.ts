"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  ChessAnalysisStreamResponseEvent,
  ChessAnalysisStatusResponse,
} from "@/lib/chess-analysis-types";
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
        const response = await fetch(`/api/chess-analysis?runId=${runId}`);
        const data = (await response.json()) as
          | ChessAnalysisStatusResponse
          | { error?: string };

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setRequestState({
            kind: "error",
            runId,
            message: "error" in data && data.error ? data.error : "Polling failed.",
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

        if (
          statusData.status === "failed" ||
          statusData.status === "cancelled"
        ) {
          setRequestState({
            kind: "error",
            runId,
            message: `Workflow ${statusData.status}.`,
          });
          return;
        }

        setRequestState((current) => ({
          kind: "polling",
          runId,
          status: statusData.status,
          progress:
            current.kind === "polling" && current.runId === runId
              ? current.progress
              : emptyProgress(),
        }));
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

  function applyStreamEvent(streamEvent: ChessAnalysisStreamResponseEvent) {
    if (streamEvent.type === "started") {
      setRequestState((current) => {
        if (isCurrentCompletedRun(current, streamEvent.runId)) {
          return current;
        }

        return {
          kind: "polling",
          runId: streamEvent.runId,
          status: streamEvent.status,
          progress:
            current.kind === "polling" && current.runId === streamEvent.runId
              ? current.progress
              : emptyProgress(),
        };
      });
      return;
    }

    if (streamEvent.type === "position") {
      setRequestState((current) => {
        if (isCurrentCompletedRun(current, streamEvent.runId)) {
          return current;
        }

        return {
          kind: "polling",
          runId: streamEvent.runId,
          status: getCurrentStatus(current, streamEvent.runId),
          progress: appendPosition(
            getCurrentProgress(current, streamEvent.runId),
            streamEvent.position,
            streamEvent.totalPositions
          ),
        };
      });
      return;
    }

    if (streamEvent.type === "evaluation") {
      setRequestState((current) => {
        if (isCurrentCompletedRun(current, streamEvent.runId)) {
          return current;
        }

        return {
          kind: "polling",
          runId: streamEvent.runId,
          status: getCurrentStatus(current, streamEvent.runId),
          progress: appendEvaluation(
            getCurrentProgress(current, streamEvent.runId),
            streamEvent.item,
            streamEvent.totalPositions
          ),
        };
      });
      return;
    }

    if (streamEvent.type === "status") {
      if (
        streamEvent.status === "failed" ||
        streamEvent.status === "cancelled"
      ) {
        setRequestState({
          kind: "error",
          runId: streamEvent.runId,
          message: `Workflow ${streamEvent.status}.`,
        });
        return;
      }

      setRequestState((current) => {
        if (isCurrentCompletedRun(current, streamEvent.runId)) {
          return current;
        }

        return {
          kind: "polling",
          runId: streamEvent.runId,
          status: streamEvent.status,
          progress: getCurrentProgress(current, streamEvent.runId),
        };
      });
      return;
    }

    setRequestState({
      kind: "error",
      runId: streamEvent.runId,
      message: streamEvent.message,
    });
  }

  async function runAnalysis() {
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
  }

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
