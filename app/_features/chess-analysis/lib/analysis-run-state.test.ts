import { describe, expect, it } from "vitest";

import type {
  ChessAnalysisResult,
  ChessPosition,
  ChessPositionEvaluation,
} from "@/lib/chess/types";
import type { ChessAnalysisRequestState } from "../types";
import { getStateAfterStreamEvent } from "./analysis-run-state";

const START: ChessPosition = {
  fen: "start-fen",
  lan: "start",
  moveNumber: 0,
  ply: 0,
  san: "start",
  sideToMove: "w",
};

const E4: ChessPosition = {
  fen: "e4-fen",
  lan: "e2e4",
  moveNumber: 1,
  ply: 1,
  san: "e4",
  sideToMove: "b",
};

const E4_EVAL: ChessPositionEvaluation = {
  evaluation: {
    available: true,
    eval: 0.27,
  },
  position: E4,
};

const RESULT: ChessAnalysisResult = {
  evaluations: {
    availableCount: 1,
    count: 1,
    items: [E4_EVAL],
  },
  positions: {
    all: [START, E4],
    count: 2,
    final: E4,
  },
  source: "chess-api",
};

describe("getStateAfterStreamEvent", () => {
  it("starts polling when the workflow stream announces a run", () => {
    const state = getStateAfterStreamEvent(
      { kind: "submitting" },
      {
        runId: "run-1",
        status: "running",
        type: "started",
      }
    );

    expect(state).toEqual({
      kind: "polling",
      progress: {
        evaluations: [],
        positions: [],
      },
      runId: "run-1",
      status: "running",
    });
  });

  it("accumulates streamed positions and evaluations for the same run", () => {
    const withPosition = getStateAfterStreamEvent(
      { kind: "idle" },
      {
        position: E4,
        runId: "run-1",
        totalPositions: 2,
        type: "position",
      }
    );
    const withEvaluation = getStateAfterStreamEvent(withPosition, {
      evaluatedCount: 1,
      item: E4_EVAL,
      runId: "run-1",
      totalPositions: 2,
      type: "evaluation",
    });

    expect(withEvaluation).toMatchObject({
      kind: "polling",
      progress: {
        evaluations: [E4_EVAL],
        positions: [E4],
        totalPositions: 2,
      },
      runId: "run-1",
      status: "running",
    });
  });

  it("does not let stale stream events overwrite a completed result", () => {
    const completed: ChessAnalysisRequestState = {
      kind: "completed",
      result: RESULT,
      runId: "run-1",
    };

    expect(
      getStateAfterStreamEvent(completed, {
        position: START,
        runId: "run-1",
        totalPositions: 2,
        type: "position",
      })
    ).toBe(completed);
  });

  it("maps failed terminal status events to an error state", () => {
    expect(
      getStateAfterStreamEvent(
        { kind: "idle" },
        {
          runId: "run-1",
          status: "failed",
          type: "status",
        }
      )
    ).toEqual({
      kind: "error",
      message: "Workflow failed.",
      runId: "run-1",
    });
  });
});
