import { describe, expect, it } from "vitest";

import type { ChessPosition, ChessPositionEvaluation } from "@/lib/chess/types";
import {
  appendEvaluation,
  appendPosition,
  emptyProgress,
  getEvaluationForPosition,
  getProgressForState,
} from "./analysis-progress";

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

const E4_REVISED: ChessPosition = {
  ...E4,
  fen: "e4-fen-revised",
};

function evaluation(position: ChessPosition): ChessPositionEvaluation {
  return {
    evaluation: {
      available: true,
      eval: 0.2,
    },
    position,
  };
}

describe("analysis progress helpers", () => {
  it("keeps position updates sorted and idempotent by ply", () => {
    const withE4 = appendPosition(emptyProgress(), E4, 2);
    const withStart = appendPosition(withE4, START, 2);
    const replaced = appendPosition(withStart, E4_REVISED, 2);

    expect(replaced.positions.map((position) => position.ply)).toEqual([0, 1]);
    expect(replaced.positions[1].fen).toBe("e4-fen-revised");
    expect(replaced.totalPositions).toBe(2);
  });

  it("keeps evaluation updates sorted and idempotent by position ply", () => {
    const first = appendEvaluation(emptyProgress(), evaluation(E4), 2);
    const replaced = appendEvaluation(
      first,
      {
        evaluation: {
          available: true,
          eval: 0.34,
        },
        position: E4_REVISED,
      },
      2
    );

    expect(replaced.evaluations).toHaveLength(1);
    expect(replaced.evaluations[0].evaluation.eval).toBe(0.34);
    expect(replaced.evaluations[0].position.fen).toBe("e4-fen-revised");
  });

  it("matches evaluations by both ply and FEN", () => {
    const item = evaluation(E4);

    expect(getEvaluationForPosition([item], E4)).toBe(item);
    expect(getEvaluationForPosition([item], E4_REVISED)).toBeUndefined();
  });

  it("projects completed state into the same progress shape as streaming state", () => {
    const item = evaluation(E4);
    const progress = getProgressForState({
      kind: "completed",
      runId: "run-1",
      result: {
        evaluations: {
          availableCount: 1,
          count: 1,
          items: [item],
        },
        positions: {
          all: [START, E4],
          count: 2,
          final: E4,
        },
        source: "chess-api",
      },
    });

    expect(progress).toEqual({
      evaluations: [item],
      positions: [START, E4],
      totalPositions: 2,
    });
  });
});
