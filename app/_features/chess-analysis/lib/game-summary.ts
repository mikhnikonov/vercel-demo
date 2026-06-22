import type {
  ChessAnalysisResult,
  ChessPosition,
  ChessPositionEvaluation,
  PlayerSide,
} from "@/lib/chess/types";

export type MoveQuality = "bestMove" | "goodMove" | "mistake" | "blunder";

export type ClassifiedMove = {
  category: MoveQuality;
  currentEval?: number;
  currentMate?: number | null;
  deltaForPlayer?: number;
  deltaWinChanceForPlayer?: number;
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

// Win chance is preferred when chess-api.com provides it because it better
// reflects practical move quality than tiny pawn-eval noise in equal positions.
const MISTAKE_EVAL_DROP_THRESHOLD = 0.5;
const BLUNDER_EVAL_DROP_THRESHOLD = 1.5;
const MISTAKE_WIN_CHANCE_DROP_THRESHOLD = 10;
const BLUNDER_WIN_CHANCE_DROP_THRESHOLD = 20;
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
  // A played move is classified by comparing the engine eval immediately
  // before the move with the eval immediately after it.
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

  // The key drives useChat resubmission. Include both the move list and bucket
  // counts so changing side or classification output triggers a fresh review.
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

  // The prompt repeats the classification contract because the LLM should
  // explain the buckets, not invent a second grading system.
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

Review rules:
- Treat the move classifications above as the source of truth.
- Do not call a Good move a mistake or blunder just because it differed from the engine best move.
- Small eval or win-chance drops inside the Good move bucket are acceptable engine tolerance.

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
  // Classification needs adjacent available evals. If either side of the move
  // is missing, the summary skips the move instead of guessing.
  if (
    !previousItem?.evaluation.available ||
    !currentItem?.evaluation.available
  ) {
    return null;
  }

  const previousEvaluation = previousItem.evaluation;
  const currentEvaluation = currentItem.evaluation;
  // previousItem is the board before the move, so its side-to-move is the
  // player who made the move at the current ply.
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
  const deltaWinChanceForPlayer =
    isFiniteNumber(previousEvaluation.winChance) &&
    isFiniteNumber(currentEvaluation.winChance)
      ? toPlayerWinChance(currentEvaluation.winChance, playedBy) -
        toPlayerWinChance(previousEvaluation.winChance, playedBy)
      : undefined;
  const category = getMoveCategory({
    deltaForPlayer,
    deltaWinChanceForPlayer,
    isBestMove,
    missedMate,
  });

  if (!category) {
    return null;
  }

  return {
    category,
    currentEval,
    currentMate,
    deltaForPlayer,
    deltaWinChanceForPlayer,
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
    reason: getReason({
      category,
      deltaForPlayer,
      deltaWinChanceForPlayer,
      isBestMove,
      missedMate,
    }),
  };
}

type MoveCategoryInput = {
  deltaForPlayer: number | undefined;
  deltaWinChanceForPlayer: number | undefined;
  isBestMove: boolean;
  missedMate: boolean;
};

function getMoveCategory({
  deltaForPlayer,
  deltaWinChanceForPlayer,
  isBestMove,
  missedMate,
}: MoveCategoryInput): MoveQuality | null {
  // Matching the engine move is always surfaced separately, even if the eval
  // barely changes for another playable move.
  if (isBestMove) {
    return "bestMove";
  }

  if (missedMate) {
    return "blunder";
  }

  // Use win-chance thresholds first; pawn-eval thresholds are only a fallback
  // for engine responses that do not include winChance.
  if (typeof deltaWinChanceForPlayer === "number") {
    if (deltaWinChanceForPlayer <= -BLUNDER_WIN_CHANCE_DROP_THRESHOLD) {
      return "blunder";
    }

    if (deltaWinChanceForPlayer <= -MISTAKE_WIN_CHANCE_DROP_THRESHOLD) {
      return "mistake";
    }

    return "goodMove";
  }

  if (typeof deltaForPlayer !== "number") {
    return null;
  }

  if (deltaForPlayer <= -BLUNDER_EVAL_DROP_THRESHOLD) {
    return "blunder";
  }

  if (deltaForPlayer <= -MISTAKE_EVAL_DROP_THRESHOLD) {
    return "mistake";
  }

  return "goodMove";
}

function moveMatchesBestMove(
  position: ChessPosition,
  previousItem: ChessPositionEvaluation
) {
  // chess-api.com may return the best move as SAN, LAN, UCI-like move text, or
  // the first continuation item, so normalize all candidates before comparing.
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
  // Mate scores are mapped to a large signed pawn value only as a fallback, so
  // ordinary eval/centipawn values stay the primary numerical comparison.
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

function toPlayerWinChance(
  winChance: number,
  playedBy: ClassifiedMove["playedBy"]
) {
  return playedBy === "white" ? winChance : 100 - winChance;
}

function getPlayedByFromPly(ply: number): PlayerSide {
  return ply % 2 === 1 ? "white" : "black";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeMove(move: string | undefined) {
  return (move ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("0", "o")
    .replace(/[+#?!]/g, "")
    .replace(/\s+/g, "");
}

type MoveReasonInput = MoveCategoryInput & {
  category: MoveQuality;
};

function getReason({
  category,
  deltaForPlayer,
  deltaWinChanceForPlayer,
  isBestMove,
  missedMate,
}: MoveReasonInput) {
  if (isBestMove) {
    return "Matched the engine best move from the previous position.";
  }

  if (missedMate) {
    return "Missed a forced mate available in the previous position.";
  }

  if (
    typeof deltaForPlayer !== "number" &&
    typeof deltaWinChanceForPlayer !== "number"
  ) {
    return "Adjacent eval was unavailable.";
  }

  if (category === "blunder") {
    return `Dropped ${formatLoss(
      deltaForPlayer,
      deltaWinChanceForPlayer
    )} for the moving side.`;
  }

  if (category === "mistake") {
    return `Dropped ${formatLoss(
      deltaForPlayer,
      deltaWinChanceForPlayer
    )} for the moving side.`;
  }

  if (typeof deltaWinChanceForPlayer === "number") {
    if (deltaWinChanceForPlayer < 0) {
      return `Win chance dropped ${Math.abs(
        deltaWinChanceForPlayer
      ).toFixed(1)} points, within the good-move tolerance.`;
    }

    if (deltaWinChanceForPlayer === 0) {
      return "Win chance stayed level.";
    }

    return `Win chance improved ${deltaWinChanceForPlayer.toFixed(
      1
    )} points for the moving side.`;
  }

  if (typeof deltaForPlayer !== "number") {
    return "Evaluation stayed within the good-move tolerance.";
  }

  if (deltaForPlayer < 0) {
    return `Eval dropped ${Math.abs(
      deltaForPlayer
    ).toFixed(2)} pawns, within the good-move tolerance.`;
  }

  if (deltaForPlayer === 0) {
    return "Eval stayed level.";
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
  const winChanceText =
    typeof move.deltaWinChanceForPlayer === "number"
      ? `; win chance delta ${formatSigned(
          move.deltaWinChanceForPlayer,
          1
        )} points`
      : "";
  const bestMoveText = move.previousBestMoveSan ?? move.previousBestMove ?? "-";

  return `- ${move.moveNumber}. ${move.playedSan} (${move.playedBy}, ply ${move.ply}): ${move.reason}${evalText}${winChanceText}; engine best was ${bestMoveText}.`;
}

function formatLoss(
  deltaForPlayer: number | undefined,
  deltaWinChanceForPlayer: number | undefined
) {
  if (typeof deltaWinChanceForPlayer === "number") {
    return `${Math.abs(deltaWinChanceForPlayer).toFixed(
      1
    )} win-chance points`;
  }

  return `${Math.abs(deltaForPlayer ?? 0).toFixed(2)} pawns`;
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

function formatSigned(value: number, fractionDigits = 2) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(fractionDigits)}`;
}
