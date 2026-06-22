import { Chess } from "chess.js";

import type { ChessPosition } from "@/lib/chess/types";

export const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type PgnPositionParseResult = {
  error?: string;
  positions: ChessPosition[];
};

export function parsePgnPositions(pgn: string): PgnPositionParseResult {
  if (!pgn.trim()) {
    return { positions: [createPosition(STARTING_FEN)] };
  }

  const chess = new Chess();

  try {
    chess.loadPgn(pgn, { strict: false });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "The PGN could not be parsed.",
      positions: [createPosition(STARTING_FEN)],
    };
  }

  const moves = chess.history({ verbose: true });

  if (moves.length === 0) {
    return { positions: [createPosition(chess.fen())] };
  }

  return {
    positions: [
      createPosition(moves[0].before),
      ...moves.map((move, index) => ({
        ply: index + 1,
        moveNumber: Math.ceil((index + 1) / 2),
        san: move.san,
        lan: move.lan,
        fen: move.after,
        sideToMove: sideToMoveFromFen(move.after),
      })),
    ],
  };
}

function createPosition(fen: string): ChessPosition {
  return {
    ply: 0,
    moveNumber: 0,
    san: "start",
    lan: "start",
    fen,
    sideToMove: sideToMoveFromFen(fen),
  };
}

function sideToMoveFromFen(fen: string): "w" | "b" {
  return fen.trim().split(/\s+/)[1] === "b" ? "b" : "w";
}
