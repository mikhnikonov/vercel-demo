"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type ChatStatus } from "ai";
import { useEffect, useMemo, useRef } from "react";
import { Streamdown } from "streamdown";

import { getJsonErrorMessage } from "@/lib/http";
import type { PlayerSide } from "@/lib/chess/types";
import type { AiTutorPhase } from "../../types";
import {
  buildTutorPrompt,
  countByCategory,
  createGameSummary,
  getQualityLabel,
  type MoveQuality,
} from "../../lib/game-summary";
import { useChessAnalysis } from "../../state/ChessAnalysisProvider";

const CATEGORY_ORDER: MoveQuality[] = [
  "bestMove",
  "goodMove",
  "mistake",
  "blunder",
];

const CHAT_ERROR_FALLBACK = "AI tutor could not generate a review.";

const CHAT_TRANSPORT = new DefaultChatTransport({
  api: "/api/chat",
  fetch: fetchChatResponse,
});

async function fetchChatResponse(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);

  if (response.ok) {
    return response;
  }

  throw new Error(await getChatErrorMessage(response));
}

async function getChatErrorMessage(response: Response) {
  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    const data = await response.json().catch(() => null);
    return getJsonErrorMessage(data, CHAT_ERROR_FALLBACK);
  }

  const message = await response.text().catch(() => "");
  return message.trim() || CHAT_ERROR_FALLBACK;
}

export function AiTutorPanel() {
  const { playerSide, result, setTutorPhase } = useChessAnalysis();
  const submittedSummaryKey = useRef<string | undefined>(undefined);
  const {
    error: chatError,
    messages,
    setMessages,
    sendMessage,
    status: chatStatus,
    clearError,
  } = useChat({ transport: CHAT_TRANSPORT });
  const summary = useMemo(
    () => (result ? createGameSummary(result, playerSide) : null),
    [playerSide, result]
  );
  const assistantMessages = messages.filter(
    (message) => message.role === "assistant"
  );
  const categoryCounts = summary ? countByCategory(summary.categories) : null;
  const tutorPhase = getTutorPhase({
    assistantMessageCount: assistantMessages.length,
    chatError,
    chatStatus,
    hasSummary: Boolean(summary),
  });

  useEffect(() => {
    setTutorPhase(tutorPhase);
  }, [setTutorPhase, tutorPhase]);

  useEffect(() => {
    if (summary) {
      return;
    }

    submittedSummaryKey.current = undefined;
    setMessages([]);
    clearError();
  }, [clearError, setMessages, summary]);

  useEffect(() => {
    if (!summary || chatStatus !== "ready") {
      return;
    }

    if (submittedSummaryKey.current === summary.key) {
      return;
    }

    submittedSummaryKey.current = summary.key;
    setMessages([]);
    clearError();
    void sendMessage({ text: buildTutorPrompt(summary) });
  }, [chatStatus, clearError, sendMessage, setMessages, summary]);

  return (
    <section className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-950">AI tutor</h2>
          <p className="mt-1 text-sm text-zinc-600">
            {getTutorPhaseLabel(tutorPhase, playerSide)}
          </p>
        </div>
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {getTutorPhaseBadge(tutorPhase)}
        </span>
      </div>

      {summary && categoryCounts ? (
        <div className="mt-4 space-y-4">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {CATEGORY_ORDER.map((category) => (
              <div
                className="rounded-md border border-zinc-200 p-3"
                key={category}
              >
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {getQualityLabel(category)}
                </dt>
                <dd className="mt-1 text-lg font-semibold text-zinc-950">
                  {categoryCounts[category]}
                </dd>
              </div>
            ))}
          </dl>

          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
            Classified {summary.analyzedMoveCount}/{summary.totalMoveCount}{" "}
            {summary.playerSide} moves from the completed analysis.
            {summary.skippedMoveCount > 0
              ? ` ${summary.skippedMoveCount} moves were skipped because adjacent evals were unavailable.`
              : ""}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {CATEGORY_ORDER.map((category) => {
              const moves = summary.categories[category];

              return (
                <section
                  className="rounded-md border border-zinc-200 p-3"
                  key={category}
                >
                  <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {getQualityLabel(category)}
                  </h3>
                  {moves.length > 0 ? (
                    <div className="mt-2 flex max-h-28 flex-wrap gap-2 overflow-y-auto">
                      {moves.map((move) => (
                        <span
                          className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-800"
                          key={move.ply}
                          title={move.reason}
                        >
                          {move.moveNumber}. {move.playedSan}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-zinc-500">None</p>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-600">
          Complete a PGN analysis to generate a tutor review.
        </div>
      )}

      {assistantMessages.length > 0 ? (
        <div className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-3">
          {assistantMessages.map((message) => (
            <div
              className="rounded-md border border-zinc-200 bg-white p-3 text-sm leading-6"
              key={message.id}
            >
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Tutor review
              </div>
              <div className="text-zinc-800">
                {message.parts.map((part, index) =>
                  part.type === "text" ? (
                    <Streamdown
                      className="text-sm leading-6"
                      isAnimating={chatStatus === "streaming"}
                      key={index}
                    >
                      {part.text}
                    </Streamdown>
                  ) : null
                )}
              </div>
            </div>
          ))}
        </div>
      ) : summary ? (
        <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          {chatStatus === "ready"
            ? "Preparing summary for the AI tutor."
            : "AI evaluation in progress."}
        </div>
      ) : null}

      {chatError ? (
        <p
          className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="status"
        >
          {chatError.message || CHAT_ERROR_FALLBACK}
        </p>
      ) : null}
    </section>
  );
}

type TutorPhaseInput = {
  assistantMessageCount: number;
  chatError: Error | undefined;
  chatStatus: ChatStatus;
  hasSummary: boolean;
};

function getTutorPhase({
  assistantMessageCount,
  chatError,
  chatStatus,
  hasSummary,
}: TutorPhaseInput): AiTutorPhase {
  if (chatError || chatStatus === "error") {
    return "error";
  }

  if (!hasSummary) {
    return "idle";
  }

  if (chatStatus === "submitted" || chatStatus === "streaming") {
    return "ai-evaluation";
  }

  if (assistantMessageCount > 0) {
    return "ready";
  }

  return "preparing-summary";
}

function getTutorPhaseLabel(phase: AiTutorPhase, playerSide: PlayerSide) {
  if (phase === "idle") {
    return `Will review your ${playerSide} moves after analysis.`;
  }

  if (phase === "preparing-summary") {
    return `Preparing your ${playerSide} move summary.`;
  }

  if (phase === "ai-evaluation") {
    return `AI evaluation in progress for your ${playerSide} game.`;
  }

  if (phase === "ready") {
    return `Reviewing your ${playerSide} moves.`;
  }

  return "AI tutor review failed.";
}

function getTutorPhaseBadge(phase: AiTutorPhase) {
  if (phase === "idle") {
    return "waiting";
  }

  if (phase === "preparing-summary") {
    return "summary";
  }

  if (phase === "ai-evaluation") {
    return "evaluating";
  }

  if (phase === "ready") {
    return "ready";
  }

  return "error";
}
