import { z } from "zod";

import { delay } from "@/lib/async";
import type { ChessApiEvaluation, ChessPosition } from "@/lib/chess/types";
import { getJsonErrorMessage, readJsonBody } from "@/lib/http";

const CHESS_API_URL = "https://chess-api.com/v1";
const CHESS_API_RETRY_DELAYS_MS = [0, 300];

const optionalString = z.preprocess(
  (value) =>
    value === null || value === undefined ? undefined : String(value),
  z.string().optional()
);

const optionalNumber = z.preprocess(
  (value) => coerceFiniteNumber(value),
  z.number().optional()
);

const optionalMate = z.preprocess((value) => {
  if (value === null) {
    return null;
  }

  return coerceFiniteNumber(value);
}, z.number().nullable().optional());

const optionalMoveList = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    return value.trim().split(/\s+/).filter(Boolean);
  }

  return undefined;
}, z.array(z.string()).optional());

const CHESS_API_EVALUATION_SCHEMA = z
  .object({
    centipawns: optionalString,
    continuationArr: optionalMoveList,
    depth: optionalNumber,
    eval: optionalNumber,
    fen: optionalString,
    lan: optionalString,
    mate: optionalMate,
    move: optionalString,
    san: optionalString,
    text: optionalString,
    winChance: optionalNumber,
  })
  .passthrough();

export async function getChessApiEvaluation(
  position: ChessPosition
): Promise<ChessApiEvaluation> {
  let lastEvaluation: ChessApiEvaluation | undefined;

  for (const delayMs of CHESS_API_RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await delay(delayMs);
    }

    let evaluation: ChessApiEvaluation;
    let retryable = false;

    try {
      evaluation = await requestChessApiEvaluation(position);
      retryable = isRetryableStatus(evaluation.status);
    } catch (error) {
      evaluation = {
        available: false,
        error:
          error instanceof Error
            ? `chess-api.com request failed: ${error.message}`
            : "chess-api.com request failed.",
      };
      retryable = true;
    }

    if (evaluation.available || !retryable) {
      return evaluation;
    }

    lastEvaluation = evaluation;
  }

  return lastEvaluation ?? {
    available: false,
    error: "chess-api.com did not return an evaluation.",
  };
}

async function requestChessApiEvaluation(
  position: ChessPosition
): Promise<ChessApiEvaluation> {
  const response = await fetch(CHESS_API_URL, {
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

  const data = await readJsonBody(response);

  if (!response.ok) {
    return {
      available: false,
      status: response.status,
      error: getJsonErrorMessage(
        data,
        "chess-api.com did not return an evaluation."
      ),
      raw: data,
    };
  }

  return normalizeChessApiEvaluation(data);
}

function normalizeChessApiEvaluation(data: unknown): ChessApiEvaluation {
  const parsed = CHESS_API_EVALUATION_SCHEMA.safeParse(data);

  if (!parsed.success) {
    return {
      available: false,
      error: "chess-api.com returned an unexpected response.",
      raw: data,
    };
  }

  const record = parsed.data;

  return {
    available: true,
    text: record.text,
    fen: record.fen,
    eval: record.eval,
    centipawns: record.centipawns,
    mate: record.mate,
    move: record.move,
    san: record.san,
    lan: record.lan,
    depth: record.depth,
    winChance: record.winChance,
    continuationArr: record.continuationArr,
    raw: data,
  };
}

function coerceFiniteNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function isRetryableStatus(status: number | undefined) {
  return (
    status === 408 ||
    status === 429 ||
    (status !== undefined && status >= 500)
  );
}
