import type {
  ChessAnalysisResult,
  ChessPosition,
  ChessPositionEvaluation,
} from "@/lib/chess-analysis-types";

export type MoveQuality = "bestMove" | "goodMove" | "mistake" | "blunder";
export type PlayerSide = "white" | "black";

export type ClassifiedMove = {
  category: MoveQuality;
  currentEval?: number;
  currentMate?: number | null;
  deltaForPlayer?: number;
  missedMate: boolean;
  moveNumber: number;
  playedBy: PlayerSide;
  playedLan: string;
  playedSan: string;
  ply: number;
  previousBestMove?: string;
  previousBestMoveSan?: string;
  previousEval?: number;
  previousMate?: number | null;
  reason: string;
};

export type GameSummary = {
  analyzedMoveCount: number;
  categories: Record<MoveQuality, ClassifiedMove[]>;
  finalFen: string;
  key: string;
  playerSide: PlayerSide;
  skippedMoveCount: number;
  source: ChessAnalysisResult["source"];
  totalMoveCount: number;
};

const BLUNDER_THRESHOLD = 1;
const MATE_SCORE = 100;

const QUALITY_LABELS: Record<MoveQuality, string> = {
  bestMove: "Best move",
  goodMove: "Good move",
  mistake: "Mistake",
  blunder: "Blunder",
};

const QUALITY_ORDER: MoveQuality[] = [
  "blunder",
  "mistake",
  "bestMove",
  "goodMove",
];

export function createGameSummary(
  result: ChessAnalysisResult,
  playerSide: PlayerSide
): GameSummary {
  const evaluationsByPly = new Map(
    result.evaluations.items.map((item) => [item.position.ply, item])
  );
  const categories: GameSummary["categories"] = {
    bestMove: [],
    goodMove: [],
    mistake: [],
    blunder: [],
  };
  let skippedMoveCount = 0;
  let totalMoveCount = 0;

  for (const position of result.positions.all) {
    if (position.ply === 0) {
      continue;
    }

    if (getPlayedByFromPly(position.ply) !== playerSide) {
      continue;
    }

    totalMoveCount += 1;

    const previousItem = evaluationsByPly.get(position.ply - 1);
    const currentItem = evaluationsByPly.get(position.ply);
    const classifiedMove = classifyMove(position, previousItem, currentItem);

    if (!classifiedMove) {
      skippedMoveCount += 1;
      continue;
    }

    categories[classifiedMove.category].push(classifiedMove);
  }

  const analyzedMoveCount = Object.values(categories).reduce(
    (count, moves) => count + moves.length,
    0
  );
  const counts = countByCategory(categories);
  const moveSignature = result.positions.all
    .map((position) => `${position.ply}:${position.san}`)
    .join(",");

  return {
    analyzedMoveCount,
    categories,
    finalFen: result.positions.final.fen,
    key: [
      playerSide,
      result.source,
      result.positions.count,
      result.evaluations.availableCount,
      result.positions.final.fen,
      moveSignature,
      counts.bestMove,
      counts.goodMove,
      counts.mistake,
      counts.blunder,
    ].join("|"),
    playerSide,
    skippedMoveCount,
    source: result.source,
    totalMoveCount,
  };
}

export function buildTutorPrompt(summary: GameSummary): string {
  const counts = countByCategory(summary.categories);
  const groupedMoves = QUALITY_ORDER.map((category) => {
    const moves = summary.categories[category];

    if (moves.length === 0) {
      return `${QUALITY_LABELS[category]}s: none`;
    }

    return [
      `${QUALITY_LABELS[category]}s:`,
      ...moves.map(formatMoveForPrompt),
    ].join("\n");
  }).join("\n\n");

  const skippedLine =
    summary.skippedMoveCount > 0
      ? `\nSkipped moves: ${summary.skippedMoveCount} moves could not be classified because an adjacent evaluation was unavailable.`
      : "";

  return `I played this game as ${summary.playerSide}. Review only my ${summary.playerSide} moves from the engine summary below.

Game totals:
- Source: ${summary.source}
- Side reviewed: ${summary.playerSide}
- Classified moves for my side: ${summary.analyzedMoveCount}/${summary.totalMoveCount}
- Best moves: ${counts.bestMove}
- Good moves: ${counts.goodMove}
- Mistakes: ${counts.mistake}
- Blunders: ${counts.blunder}${skippedLine}

Move classifications:
${groupedMoves}

Give me a practical review of my game. Focus on my blunders and mistakes first, explain the turning points in my decisions, and suggest one or two training themes.`;
}

export function countByCategory(categories: GameSummary["categories"]) {
  return {
    bestMove: categories.bestMove.length,
    goodMove: categories.goodMove.length,
    mistake: categories.mistake.length,
    blunder: categories.blunder.length,
  };
}

export function getQualityLabel(category: MoveQuality) {
  return QUALITY_LABELS[category];
}

function classifyMove(
  position: ChessPosition,
  previousItem?: ChessPositionEvaluation,
  currentItem?: ChessPositionEvaluation
): ClassifiedMove | null {
  if (
    !previousItem?.evaluation.available ||
    !currentItem?.evaluation.available
  ) {
    return null;
  }

  const previousEvaluation = previousItem.evaluation;
  const currentEvaluation = currentItem.evaluation;
  const playedBy = previousItem.position.sideToMove === "b" ? "black" : "white";
  const isBestMove = moveMatchesBestMove(position, previousItem);
  const missedMate = hasMateForSideToMove(previousItem) && !isBestMove;
  const previousMate = previousEvaluation.mate;
  const currentMate = currentEvaluation.mate;
  const previousEval = getPositionScore(previousEvaluation);
  const currentEval = getPositionScore(currentEvaluation);
  const deltaForPlayer =
    typeof previousEval === "number" && typeof currentEval === "number"
      ? toPlayerEval(currentEval, playedBy) -
        toPlayerEval(previousEval, playedBy)
      : undefined;
  const category = getMoveCategory(isBestMove, missedMate, deltaForPlayer);

  if (!category) {
    return null;
  }

  return {
    category,
    currentEval,
    currentMate,
    deltaForPlayer,
    missedMate,
    moveNumber: position.moveNumber,
    playedBy,
    playedLan: position.lan,
    playedSan: position.san,
    ply: position.ply,
    previousBestMove: previousEvaluation.move ?? previousEvaluation.lan,
    previousBestMoveSan: previousEvaluation.san,
    previousEval,
    previousMate,
    reason: getReason(category, isBestMove, missedMate, deltaForPlayer),
  };
}

function getMoveCategory(
  isBestMove: boolean,
  missedMate: boolean,
  deltaForPlayer: number | undefined
): MoveQuality | null {
  if (isBestMove) {
    return "bestMove";
  }

  if (missedMate) {
    return "blunder";
  }

  if (typeof deltaForPlayer !== "number") {
    return null;
  }

  if (deltaForPlayer <= -BLUNDER_THRESHOLD) {
    return "blunder";
  }

  if (deltaForPlayer < 0) {
    return "mistake";
  }

  return "goodMove";
}

function moveMatchesBestMove(
  position: ChessPosition,
  previousItem: ChessPositionEvaluation
) {
  const playedMoveCandidates = [position.lan, position.san];
  const bestMoveCandidates = [
    previousItem.evaluation.move,
    previousItem.evaluation.lan,
    previousItem.evaluation.san,
    previousItem.evaluation.continuationArr?.[0],
  ];

  return playedMoveCandidates.some((playedMove) =>
    bestMoveCandidates.some(
      (bestMove) => normalizeMove(playedMove) === normalizeMove(bestMove)
    )
  );
}

function hasMateForSideToMove(item: ChessPositionEvaluation) {
  const mate = item.evaluation.mate;

  if (typeof mate !== "number" || mate === 0) {
    return false;
  }

  return item.position.sideToMove === "w" ? mate > 0 : mate < 0;
}

function getPositionScore(evaluation: ChessPositionEvaluation["evaluation"]) {
  if (typeof evaluation.eval === "number") {
    return evaluation.eval;
  }

  if (evaluation.centipawns) {
    const parsedCentipawns = Number.parseFloat(evaluation.centipawns);

    if (Number.isFinite(parsedCentipawns)) {
      return parsedCentipawns / 100;
    }
  }

  if (typeof evaluation.mate === "number" && evaluation.mate !== 0) {
    return evaluation.mate > 0 ? MATE_SCORE : -MATE_SCORE;
  }

  return undefined;
}

function toPlayerEval(evalValue: number, playedBy: ClassifiedMove["playedBy"]) {
  return playedBy === "white" ? evalValue : -evalValue;
}

function getPlayedByFromPly(ply: number): PlayerSide {
  return ply % 2 === 1 ? "white" : "black";
}

function normalizeMove(move: string | undefined) {
  return (move ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("0", "o")
    .replace(/[+#?!]/g, "")
    .replace(/\s+/g, "");
}

function getReason(
  category: MoveQuality,
  isBestMove: boolean,
  missedMate: boolean,
  deltaForPlayer: number | undefined
) {
  if (isBestMove) {
    return "Matched the engine best move from the previous position.";
  }

  if (missedMate) {
    return "Missed a forced mate available in the previous position.";
  }

  if (typeof deltaForPlayer !== "number") {
    return "Adjacent eval was unavailable.";
  }

  if (category === "blunder") {
    return `Eval dropped ${Math.abs(deltaForPlayer).toFixed(2)} pawns for the moving side.`;
  }

  if (category === "mistake") {
    return `Eval dropped ${Math.abs(deltaForPlayer).toFixed(2)} pawns for the moving side.`;
  }

  return `Eval improved ${deltaForPlayer.toFixed(2)} pawns for the moving side.`;
}

function formatMoveForPrompt(move: ClassifiedMove) {
  const evalText =
    typeof move.deltaForPlayer === "number"
      ? ` eval ${formatEval(
          move.previousEval,
          move.previousMate
        )} -> ${formatEval(
          move.currentEval,
          move.currentMate
        )}; side delta ${formatSigned(move.deltaForPlayer)}`
      : "";
  const bestMoveText = move.previousBestMoveSan ?? move.previousBestMove ?? "-";

  return `- ${move.moveNumber}. ${move.playedSan} (${move.playedBy}, ply ${move.ply}): ${move.reason}${evalText}; engine best was ${bestMoveText}.`;
}

function formatEval(
  value: number | undefined,
  mate: number | null | undefined
) {
  if (typeof mate === "number" && mate !== 0) {
    return `M${formatSigned(mate)}`;
  }

  return typeof value === "number" ? formatSigned(value) : "-";
}

function formatSigned(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}
