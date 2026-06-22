import { describe, expect, it } from "vitest";

import { parsePgnPositions, STARTING_FEN } from "./pgn";

describe("parsePgnPositions", () => {
  it("returns the starting position for empty PGN input", () => {
    const result = parsePgnPositions("   ");

    expect(result.error).toBeUndefined();
    expect(result.positions).toEqual([
      {
        fen: STARTING_FEN,
        lan: "start",
        moveNumber: 0,
        ply: 0,
        san: "start",
        sideToMove: "w",
      },
    ]);
  });

  it("returns start plus one position per played move", () => {
    const result = parsePgnPositions("1. e4 e5 2. Nf3");

    expect(result.error).toBeUndefined();
    expect(result.positions).toHaveLength(4);
    expect(result.positions.map((position) => position.san)).toEqual([
      "start",
      "e4",
      "e5",
      "Nf3",
    ]);
    expect(result.positions[1]).toMatchObject({
      lan: "e2e4",
      moveNumber: 1,
      ply: 1,
      sideToMove: "b",
    });
    expect(result.positions[2]).toMatchObject({
      lan: "e7e5",
      moveNumber: 1,
      ply: 2,
      sideToMove: "w",
    });
  });
});
