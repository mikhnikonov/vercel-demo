import { describe, expect, it } from "vitest";

import type {
  ChessAnalysisResult,
  ChessApiEvaluation,
  ChessPosition,
  ChessPositionEvaluation,
} from "@/lib/chess/types";
import { buildTutorPrompt, createGameSummary } from "./game-summary";

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

function evaluation(
  position: ChessPosition,
  evaluation: Partial<ChessApiEvaluation>
): ChessPositionEvaluation {
  return {
    evaluation: {
      available: true,
      ...evaluation,
    },
    position,
  };
}

function result(items: ChessPositionEvaluation[]): ChessAnalysisResult {
  return {
    evaluations: {
      availableCount: items.filter((item) => item.evaluation.available).length,
      count: items.length,
      items,
    },
    positions: {
      all: [START, E4],
      count: 2,
      final: E4,
    },
    source: "chess-api",
  };
}

describe("createGameSummary", () => {
  it("keeps a tiny e4 eval drop in the good move bucket", () => {
    const summary = createGameSummary(
      result([
        evaluation(START, {
          eval: 0.34,
          move: "g1f3",
          san: "Nf3",
          winChance: 53.1256867324871,
        }),
        evaluation(E4, {
          eval: 0.27,
          move: "e7e5",
          san: "e5",
          winChance: 52.48335896523928,
        }),
      ]),
      "white"
    );

    expect(summary.categories.goodMove).toHaveLength(1);
    expect(summary.categories.goodMove[0]).toMatchObject({
      deltaForPlayer: expect.closeTo(-0.07, 4),
      playedSan: "e4",
      previousBestMoveSan: "Nf3",
    });
    expect(summary.categories.goodMove[0].reason).toContain(
      "within the good-move tolerance"
    );
    expect(summary.categories.mistake).toHaveLength(0);
  });

  it("classifies large win-chance drops as mistakes", () => {
    const summary = createGameSummary(
      result([
        evaluation(START, {
          eval: 0.2,
          winChance: 55,
        }),
        evaluation(E4, {
          eval: -0.4,
          winChance: 42,
        }),
      ]),
      "white"
    );

    expect(summary.categories.mistake).toHaveLength(1);
    expect(summary.categories.mistake[0].reason).toContain(
      "13.0 win-chance points"
    );
  });

  it("classifies exact engine matches as best moves", () => {
    const summary = createGameSummary(
      result([
        evaluation(START, {
          eval: 0.34,
          move: "e2e4",
          san: "e4",
          winChance: 53,
        }),
        evaluation(E4, {
          eval: 0.27,
          winChance: 52,
        }),
      ]),
      "white"
    );

    expect(summary.categories.bestMove).toHaveLength(1);
    expect(summary.categories.bestMove[0].playedSan).toBe("e4");
  });

  it("skips moves without adjacent available evaluations", () => {
    const summary = createGameSummary(
      result([
        evaluation(START, {
          eval: 0.34,
        }),
        evaluation(E4, {
          available: false,
          error: "provider unavailable",
        }),
      ]),
      "white"
    );

    expect(summary.analyzedMoveCount).toBe(0);
    expect(summary.skippedMoveCount).toBe(1);
  });
});

describe("buildTutorPrompt", () => {
  it("tells the tutor to trust the supplied classification buckets", () => {
    const summary = createGameSummary(
      result([
        evaluation(START, {
          eval: 0.34,
          move: "g1f3",
          san: "Nf3",
          winChance: 53,
        }),
        evaluation(E4, {
          eval: 0.27,
          winChance: 52.4,
        }),
      ]),
      "white"
    );

    expect(buildTutorPrompt(summary)).toContain(
      "Treat the move classifications above as the source of truth."
    );
  });
});
