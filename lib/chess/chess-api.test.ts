import { afterEach, describe, expect, it, vi } from "vitest";

import { getChessApiEvaluation } from "./chess-api";
import type { ChessPosition } from "./types";

const POSITION: ChessPosition = {
  fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
  lan: "e2e4",
  moveNumber: 1,
  ply: 1,
  san: "e4",
  sideToMove: "b",
};

describe("getChessApiEvaluation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes provider fields into the shared evaluation shape", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        centipawns: 27,
        continuationArr: "e7e5 g1f3",
        depth: "12",
        eval: "0.27",
        fen: POSITION.fen,
        mate: null,
        move: "e7e5",
        san: "e5",
        winChance: "52.4",
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const evaluation = await getChessApiEvaluation(POSITION);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(evaluation).toMatchObject({
      available: true,
      centipawns: "27",
      continuationArr: ["e7e5", "g1f3"],
      depth: 12,
      eval: 0.27,
      mate: null,
      move: "e7e5",
      san: "e5",
      winChance: 52.4,
    });
  });

  it("keeps non-retryable provider errors as unavailable evaluations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ message: "invalid fen" }, { status: 400 })
      )
    );

    const evaluation = await getChessApiEvaluation(POSITION);

    expect(evaluation).toMatchObject({
      available: false,
      error: "invalid fen",
      status: 400,
    });
  });
});
