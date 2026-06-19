import { FatalError, getWritable } from "workflow";

import { CHESS_ANALYSIS_STREAM_NAMESPACE } from "@/lib/chess-analysis-types";
import type {
  ChessAnalysisWorkflowStreamEvent,
  ChessApiEvaluation,
  ChessAnalysisResult,
  ChessPosition,
  ChessPositionEvaluation,
} from "@/lib/chess-analysis-types";

type ChessAnalysisInput = {
  pgn: string;
};

export async function analyzePgnWorkflow(
  input: ChessAnalysisInput
): Promise<ChessAnalysisResult> {
  "use workflow";

  const positions = await extractPositionsFromPgn(input.pgn);
  const finalPosition = positions.at(-1);

  if (!finalPosition || positions.length < 2) {
    throw new FatalError("The PGN did not contain any moves to analyze.");
  }

  const evaluations: ChessPositionEvaluation[] = [];

  for (let index = 0; index < positions.length; index += 1) {
    const position = positions[index];
    await streamPosition(position, positions.length);

    const evaluation = await fetchChessApiEvaluation(
      position,
      index + 1,
      positions.length
    );

    evaluations.push({ position, evaluation });
  }

  await closeClientUpdateStream();

  const availableCount = evaluations.filter(
    (item) => item.evaluation.available
  ).length;

  return {
    source:
      availableCount === positions.length
        ? "chess-api"
        : availableCount > 0
          ? "partial"
          : "none",
    positions: {
      count: positions.length,
      final: finalPosition,
      all: positions,
    },
    evaluations: {
      count: evaluations.length,
      availableCount,
      items: evaluations,
    },
  };
}

export async function extractPositionsFromPgn(
  pgn: string
): Promise<ChessPosition[]> {
  "use step";

  const { Chess } = await import("chess.js");
  const chess = new Chess();

  try {
    chess.loadPgn(pgn, { strict: false });
  } catch (error) {
    throw new FatalError(
      error instanceof Error
        ? `The PGN could not be parsed: ${error.message}`
        : "The PGN could not be parsed."
    );
  }

  const moves = chess.history({ verbose: true });

  if (moves.length === 0) {
    return [];
  }

  const positions: ChessPosition[] = [
    {
      ply: 0,
      moveNumber: 0,
      san: "start",
      lan: "start",
      fen: moves[0].before,
      sideToMove: "w",
    },
  ];

  positions.push(
    ...moves.map((move, index) => {
      const sideToMove: "w" | "b" =
        move.after.split(" ")[1] === "b" ? "b" : "w";

      return {
        ply: index + 1,
        moveNumber: Math.ceil((index + 1) / 2),
        san: move.san,
        lan: move.lan,
        fen: move.after,
        sideToMove,
      };
    })
  );

  return positions;
}

async function streamPosition(position: ChessPosition, totalPositions: number) {
  "use step";

  const writer = getWritable<ChessAnalysisWorkflowStreamEvent>({
    namespace: CHESS_ANALYSIS_STREAM_NAMESPACE,
  }).getWriter();

  try {
    await writer.write({
      type: "position",
      position,
      totalPositions,
    });
  } finally {
    writer.releaseLock();
  }
}

export async function fetchChessApiEvaluation(
  position: ChessPosition,
  evaluatedCount: number,
  totalPositions: number
): Promise<ChessApiEvaluation> {
  "use step";

  const response = await fetch("https://chess-api.com/v1", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fen: position.fen,
      variants: 1,
      depth: 12,
      maxThinkingTime: 50,
    }),
  });

  let data: unknown;

  try {
    data = await response.json();
  } catch {
    data = undefined;
  }

  if (!response.ok) {
    const evaluation: ChessApiEvaluation = {
      available: false,
      status: response.status,
      error:
        typeof data === "object" && data !== null && "error" in data
          ? String((data as { error: unknown }).error)
          : "chess-api.com did not return an evaluation.",
      raw: data,
    };

    await streamEvaluation(position, evaluation, evaluatedCount, totalPositions);

    return evaluation;
  }

  const record = data as Partial<ChessApiEvaluation>;

  const evaluation: ChessApiEvaluation = {
    available: true,
    text: asString(record.text),
    fen: asString(record.fen),
    eval: asNumber(record.eval),
    centipawns: asString(record.centipawns),
    mate:
      typeof record.mate === "number" || record.mate === null
        ? record.mate
        : undefined,
    move: asString(record.move),
    san: asString(record.san),
    lan: asString(record.lan),
    depth: asNumber(record.depth),
    winChance: asNumber(record.winChance),
    continuationArr: Array.isArray(record.continuationArr)
      ? record.continuationArr.filter(
          (move): move is string => typeof move === "string"
        )
      : undefined,
    raw: data,
  };

  await streamEvaluation(position, evaluation, evaluatedCount, totalPositions);

  return evaluation;
}

async function streamEvaluation(
  position: ChessPosition,
  evaluation: ChessApiEvaluation,
  evaluatedCount: number,
  totalPositions: number
) {
  const writer = getWritable<ChessAnalysisWorkflowStreamEvent>({
    namespace: CHESS_ANALYSIS_STREAM_NAMESPACE,
  }).getWriter();

  try {
    await writer.write({
      type: "evaluation",
      item: { position, evaluation },
      evaluatedCount,
      totalPositions,
    });
  } finally {
    writer.releaseLock();
  }
}

async function closeClientUpdateStream(): Promise<void> {
  "use step";

  await getWritable({
    namespace: CHESS_ANALYSIS_STREAM_NAMESPACE,
  }).close();
}

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown) {
  return typeof value === "number" ? value : undefined;
}
