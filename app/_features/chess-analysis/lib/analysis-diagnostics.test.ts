import { describe, expect, it } from "vitest";

import type { AnalysisProgress } from "../types";
import { getAnalysisDiagnostics, getEngineFailureMessage } from "./analysis-diagnostics";

const progress: AnalysisProgress = {
  evaluations: [
    {
      evaluation: {
        available: true,
      },
      position: {
        fen: "start-fen",
        lan: "start",
        moveNumber: 0,
        ply: 0,
        san: "start",
        sideToMove: "w",
      },
    },
    {
      evaluation: {
        available: false,
        error: "rate limited",
        status: 429,
      },
      position: {
        fen: "e4-fen",
        lan: "e2e4",
        moveNumber: 1,
        ply: 1,
        san: "e4",
        sideToMove: "b",
      },
    },
  ],
  positions: [],
  totalPositions: 2,
};

describe("analysis diagnostics", () => {
  it("summarizes unavailable engine evaluations for the UI", () => {
    const diagnostics = getAnalysisDiagnostics(progress);

    expect(diagnostics).toMatchObject({
      availableEvaluationCount: 1,
      failedEvaluationCount: 1,
      totalPositions: 2,
    });
    expect(diagnostics.engineFailures[0]).toEqual({
      label: "1. e4",
      message: "HTTP 429: rate limited",
      status: 429,
    });
    expect(getEngineFailureMessage(diagnostics)).toContain(
      "chess-api.com did not evaluate 1 of 2 positions"
    );
  });
});
