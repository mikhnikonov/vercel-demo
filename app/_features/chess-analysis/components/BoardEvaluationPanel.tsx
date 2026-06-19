"use client";

import { useEffect, useMemo, useState } from "react";

import type { ChessAnalysisResult } from "@/lib/chess-analysis-types";
import AnimatedChessground from "@/app/_components/AnimatedChessground";
import {
  clampPositionIndex,
  getEvaluationForPosition,
  getPositionLabel,
  getSourceLabel,
} from "../lib/analysis-progress";
import { getPgnPlayback, getPgnPlaybackKey } from "../lib/pgn-playback";
import { BOARD_MOVE_INTERVAL_MS, STARTING_FEN } from "../config/constants";
import { BoardSideSwitch } from "./BoardSideSwitch";
import { EvaluationBlock } from "./EvaluationBlock";
import { EvaluationSummary } from "./EvaluationSummary";
import { Metric } from "./Metric";
import { MoveNavigationControls } from "./MoveNavigationControls";
import type { AnalysisProgress, BoardSide } from "../types";

type BoardEvaluationPanelProps = {
  onPlayerSideChange: (side: BoardSide) => void;
  playbackRunKey: number;
  playerSide: BoardSide;
  pgn: string;
  progress: AnalysisProgress;
  result: ChessAnalysisResult | null;
};

export function BoardEvaluationPanel({
  onPlayerSideChange,
  playbackRunKey,
  playerSide,
  pgn,
  progress,
  result,
}: BoardEvaluationPanelProps) {
  const [boardPositionIndex, setBoardPositionIndex] = useState(0);
  const [manualNavigation, setManualNavigation] = useState(false);
  const playback = useMemo(() => getPgnPlayback(pgn), [pgn]);
  const playbackKey = useMemo(
    () => getPgnPlaybackKey(playback.positions),
    [playback.positions]
  );
  const playbackPositions = playback.positions;
  const completed = Boolean(result);
  const currentIndex = clampPositionIndex(
    boardPositionIndex,
    playbackPositions.length
  );
  const currentPosition = playbackPositions.at(currentIndex);
  const currentEvaluation = getEvaluationForPosition(
    progress.evaluations,
    currentPosition
  );
  const boardFen = currentPosition?.fen ?? STARTING_FEN;
  const boardConfig = useMemo(
    () => ({ orientation: playerSide }),
    [playerSide]
  );
  const canGoPrevious = completed && currentIndex > 0;
  const canGoNext =
    completed && currentIndex < Math.max(playbackPositions.length - 1, 0);
  const sourceLabel = useMemo(
    () => getSourceLabel(progress, result),
    [progress, result]
  );

  useEffect(() => {
    setBoardPositionIndex(0);
    setManualNavigation(false);
  }, [playbackRunKey]);

  useEffect(() => {
    setBoardPositionIndex((current) =>
      clampPositionIndex(current, playbackPositions.length)
    );
  }, [playbackPositions.length]);

  useEffect(() => {
    if (playbackRunKey === 0) {
      return;
    }

    if (playbackPositions.length <= 1) {
      setBoardPositionIndex(0);
      return;
    }

    if (manualNavigation) {
      return;
    }

    if (boardPositionIndex >= playbackPositions.length - 1) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setBoardPositionIndex((current) =>
        Math.min(current + 1, playbackPositions.length - 1)
      );
    }, BOARD_MOVE_INTERVAL_MS);

    return () => window.clearTimeout(timeout);
  }, [
    boardPositionIndex,
    manualNavigation,
    playbackKey,
    playbackRunKey,
    playbackPositions.length,
  ]);

  function goToPreviousMove() {
    setManualNavigation(true);
    setBoardPositionIndex((current) =>
      clampPositionIndex(current - 1, playbackPositions.length)
    );
  }

  function goToNextMove() {
    setManualNavigation(true);
    setBoardPositionIndex((current) =>
      clampPositionIndex(current + 1, playbackPositions.length)
    );
  }

  return (
    <aside className="space-y-4">
      <section className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-950">
            Board and evaluation
          </h2>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            {sourceLabel}
          </span>
        </div>

        <div className="mt-4 space-y-4">
          <BoardSideSwitch
            side={playerSide}
            onSideChange={onPlayerSideChange}
          />

          <div className="aspect-square overflow-hidden rounded-md border border-zinc-200 bg-zinc-100">
            <AnimatedChessground
              className="h-full w-full"
              config={boardConfig}
              fen={boardFen}
              height="100%"
              width="100%"
            />
          </div>

          {completed ? (
            <MoveNavigationControls
              canGoNext={canGoNext}
              canGoPrevious={canGoPrevious}
              onNext={goToNextMove}
              onPrevious={goToPreviousMove}
            />
          ) : null}

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Metric label="Move" value={getPositionLabel(currentPosition)} />
            <Metric
              label="Positions"
              value={`${currentIndex + 1}/${playbackPositions.length}`}
            />
            <Metric
              label="Evaluations"
              value={`${progress.evaluations.length}/${progress.totalPositions ?? progress.positions.length}`}
            />
            <Metric
              label="Depth"
              value={currentEvaluation?.evaluation.depth ?? "-"}
            />
          </dl>

          {currentEvaluation ? (
            <EvaluationSummary item={currentEvaluation} />
          ) : (
            <div className="rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-600">
              Workflow output appears here.
            </div>
          )}

          {playback.error ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              PGN playback paused: {playback.error}
            </div>
          ) : null}

          {result ? (
            <details className="rounded-md border border-zinc-200 bg-white p-3 text-sm">
              <summary className="cursor-pointer font-medium text-zinc-700">
                Raw evaluation JSON
              </summary>
              <div className="mt-3">
                <EvaluationBlock result={result} />
              </div>
            </details>
          ) : null}
        </div>
      </section>
    </aside>
  );
}
