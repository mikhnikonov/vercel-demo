"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  ChessAnalysisStatusResponse,
  ChessAnalysisStreamResponseEvent,
} from "@/lib/chess/types";
import { isFailedChessAnalysisStatus } from "@/lib/chess/workflow-status";
import { getJsonErrorMessage, readJsonBody } from "@/lib/http";
import {
  getActiveRunId,
  getCompletedResult,
  getProgressForState,
} from "../lib/analysis-progress";
import {
  getStateAfterStreamEvent,
  toPollingState,
} from "../lib/analysis-run-state";
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

  // The POST stream gives live progress, but the workflow result is exposed by
  // GET after completion. Polling is therefore tied only to the active run id.
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
      // Keep stream handling as a reducer so late progress events cannot
      // accidentally overwrite a completed result for the same run.
      setRequestState((current) =>
        getStateAfterStreamEvent(current, streamEvent)
      );
    },
    []
  );

  const runAnalysis = useCallback(async () => {
    setRequestState({ kind: "submitting" });

    try {
      // Starting the workflow returns an NDJSON progress stream immediately;
      // final result hydration happens through the polling effect above.
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
