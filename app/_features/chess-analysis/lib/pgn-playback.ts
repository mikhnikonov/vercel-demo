import {
  parsePgnPositions,
  type PgnPositionParseResult,
} from "@/lib/chess/pgn";

export type PgnPlayback = PgnPositionParseResult;

export function getPgnPlayback(pgn: string): PgnPlayback {
  return parsePgnPositions(pgn);
}
