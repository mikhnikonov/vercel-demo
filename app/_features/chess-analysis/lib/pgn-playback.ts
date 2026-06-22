import {
  parsePgnPositions,
  type PgnPositionParseResult,
} from "@/lib/chess/pgn";

export type PgnPlayback = PgnPositionParseResult;

export function getPgnPlayback(pgn: string): PgnPlayback {
  // Keep UI playback behind a feature-level helper so components do not depend
  // directly on shared parser details.
  return parsePgnPositions(pgn);
}
