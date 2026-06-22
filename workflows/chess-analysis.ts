import { FatalError, getWritable } from "workflow";

import { getChessApiEvaluation } from "@/lib/chess/chess-api";
import { parsePgnPositions } from "@/lib/chess/pgn";
import { CHESS_ANALYSIS_STREAM_NAMESPACE } from "@/lib/chess/types";
import type {
  ChessAnalysisWorkflowStreamEvent,
  ChessApiEvaluation,
  ChessAnalysisResult,
  ChessPosition,
  ChessPositionEvaluation,
} from "@/lib/chess/types";

type ChessAnalysisInput = {
  pgn: string;
};

export async function analyzePgnWorkflow(
  input: ChessAnalysisInput
): Promise<ChessAnalysisResult> {
  "use workflow";

  // The workflow owns the durable engine-analysis pipeline. UI progress is
  // streamed separately, while this return value is the final source of truth.
  const positions = await extractPositionsFromPgn(input.pgn);
  const finalPosition = positions.at(-1);

  if (!finalPosition || positions.length < 2) {
    throw new FatalError("The PGN did not contain any moves to analyze.");
  }

  const evaluations: ChessPositionEvaluation[] = [];

  // Positions are evaluated sequentially so the streamed progress matches the
  // board order and chess-api.com is not hit with a burst of parallel calls.
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

  // Keep PGN parsing in a step so workflow replay never re-runs parsing as
  // implicit in-memory code with different side effects or error behavior.
  const result = parsePgnPositions(pgn);

  if (result.error) {
    throw new FatalError(`The PGN could not be parsed: ${result.error}`);
  }

  return result.positions;
}

async function streamPosition(position: ChessPosition, totalPositions: number) {
  "use step";

  await writeClientUpdate({
    type: "position",
    position,
    totalPositions,
  });
}

export async function fetchChessApiEvaluation(
  position: ChessPosition,
  evaluatedCount: number,
  totalPositions: number
): Promise<ChessApiEvaluation> {
  "use step";

  // Provider failures are normalized as unavailable evaluations instead of
  // throwing, so one bad engine response does not kill the full game review.
  const evaluation = await getChessApiEvaluation(position);

  await streamEvaluation(position, evaluation, evaluatedCount, totalPositions);

  return evaluation;
}

async function streamEvaluation(
  position: ChessPosition,
  evaluation: ChessApiEvaluation,
  evaluatedCount: number,
  totalPositions: number
) {
  await writeClientUpdate({
    type: "evaluation",
    item: { position, evaluation },
    evaluatedCount,
    totalPositions,
  });
}

async function writeClientUpdate(event: ChessAnalysisWorkflowStreamEvent) {
  // Every progress write uses the same short-lived writer lock; forgetting to
  // release it would block later position/evaluation updates.
  const writer = getWritable<ChessAnalysisWorkflowStreamEvent>({
    namespace: CHESS_ANALYSIS_STREAM_NAMESPACE,
  }).getWriter();

  try {
    await writer.write(event);
  } finally {
    writer.releaseLock();
  }
}

async function closeClientUpdateStream(): Promise<void> {
  "use step";

  // Closing the side-channel tells the route stream there are no more progress
  // events. The client still polls GET for the workflow return value.
  await getWritable({
    namespace: CHESS_ANALYSIS_STREAM_NAMESPACE,
  }).close();
}
