"use client";

import { useState } from "react";

import { AiTutorPanel } from "./AiTutorPanel";
import { BoardEvaluationPanel } from "./BoardEvaluationPanel";
import { ChessAnalysisForm } from "./ChessAnalysisForm";
import { useChessAnalysisRun } from "../hooks/useChessAnalysisRun";
import type { AiTutorPhase, BoardSide } from "../types";

export function ChessAnalysisExperience() {
  const {
    isBusy,
    pgn,
    progress,
    requestState,
    result,
    runAnalysis,
    setPgn,
  } = useChessAnalysisRun();
  const [playbackRun, setPlaybackRun] = useState({ key: 0, pgn });
  const [playerSide, setPlayerSide] = useState<BoardSide>("white");
  const [tutorPhase, setTutorPhase] = useState<AiTutorPhase>("idle");
  const boardPgn = playbackRun.key === 0 ? pgn : playbackRun.pgn;

  function startWorkflow() {
    setTutorPhase("idle");
    setPlaybackRun((current) => ({
      key: current.key + 1,
      pgn,
    }));
    void runAnalysis();
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-6 text-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            <ChessAnalysisForm
              isBusy={isBusy}
              onPgnChange={setPgn}
              onSubmit={startWorkflow}
              pgn={pgn}
              state={requestState}
              tutorPhase={tutorPhase}
            />
            <AiTutorPanel
              onTutorPhaseChange={setTutorPhase}
              playerSide={playerSide}
              result={result}
            />
          </div>
          <BoardEvaluationPanel
            onPlayerSideChange={setPlayerSide}
            playbackRunKey={playbackRun.key}
            playerSide={playerSide}
            pgn={boardPgn}
            progress={progress}
            result={result}
          />
        </div>
      </div>
    </main>
  );
}
