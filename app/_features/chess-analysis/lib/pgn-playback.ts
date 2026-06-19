import { Chess } from "chess.js";

import type { ChessPosition } from "@/lib/chess-analysis-types";
import { STARTING_FEN } from "../config/constants";

export type PgnPlayback = {
  error?: string;
  positions: ChessPosition[];
};

export function getPgnPlayback(pgn: string): PgnPlayback {
  if (!pgn.trim()) {
    return { positions: [startingPosition(STARTING_FEN)] };
  }

  const chess = new Chess();

  try {
    chess.loadPgn(pgn, { strict: false });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "The PGN could not be parsed.",
      positions: [startingPosition(STARTING_FEN)],
    };
  }

  const moves = chess.history({ verbose: true });

  if (moves.length === 0) {
    return { positions: [startingPosition(chess.fen())] };
  }

  return {
    positions: [
      startingPosition(moves[0].before),
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

export function getPgnPlaybackKey(positions: ChessPosition[]) {
  return positions.map((position) => `${position.ply}:${position.fen}`).join("|");
}

function startingPosition(fen: string): ChessPosition {
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
