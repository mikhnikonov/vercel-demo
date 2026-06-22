"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { ChessAnalysisResult } from "@/lib/chess/types";
import { useChessAnalysisRun } from "../hooks/useChessAnalysisRun";
import { getAnalysisDiagnostics } from "../lib/analysis-diagnostics";
import type {
  AiTutorPhase,
  AnalysisProgress,
  BoardSide,
  ChessAnalysisRequestState,
} from "../types";

type ChessAnalysisContextValue = {
  boardPgn: string;
  diagnostics: ReturnType<typeof getAnalysisDiagnostics>;
  isBusy: boolean;
  playbackRunKey: number;
  playerSide: BoardSide;
  pgn: string;
  progress: AnalysisProgress;
  requestState: ChessAnalysisRequestState;
  result: ChessAnalysisResult | null;
  setPgn: (pgn: string) => void;
  setPlayerSide: (side: BoardSide) => void;
  setTutorPhase: (phase: AiTutorPhase) => void;
  startAnalysis: () => void;
  tutorPhase: AiTutorPhase;
};

const ChessAnalysisContext = createContext<ChessAnalysisContextValue | null>(
  null
);

export function ChessAnalysisProvider({ children }: { children: ReactNode }) {
  const {
    isBusy: isEngineBusy,
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
  const diagnostics = useMemo(
    () => getAnalysisDiagnostics(progress),
    [progress]
  );
  const isBusy =
    isEngineBusy ||
    (requestState.kind === "completed" &&
      tutorPhase !== "ready" &&
      tutorPhase !== "error");
  const startAnalysis = useCallback(() => {
    if (isBusy) {
      return;
    }

    setTutorPhase("idle");
    setPlaybackRun((current) => ({
      key: current.key + 1,
      pgn,
    }));
    void runAnalysis();
  }, [isBusy, pgn, runAnalysis]);

  const value = useMemo<ChessAnalysisContextValue>(
    () => ({
      boardPgn: playbackRun.key === 0 ? pgn : playbackRun.pgn,
      diagnostics,
      isBusy,
      playbackRunKey: playbackRun.key,
      playerSide,
      pgn,
      progress,
      requestState,
      result,
      setPgn,
      setPlayerSide,
      setTutorPhase,
      startAnalysis,
      tutorPhase,
    }),
    [
      diagnostics,
      isBusy,
      playbackRun.key,
      playbackRun.pgn,
      playerSide,
      pgn,
      progress,
      requestState,
      result,
      setPgn,
      startAnalysis,
      tutorPhase,
    ]
  );

  return (
    <ChessAnalysisContext.Provider value={value}>
      {children}
    </ChessAnalysisContext.Provider>
  );
}

export function useChessAnalysis() {
  const context = useContext(ChessAnalysisContext);

  if (!context) {
    throw new Error(
      "useChessAnalysis must be used inside ChessAnalysisProvider."
    );
  }

  return context;
}
