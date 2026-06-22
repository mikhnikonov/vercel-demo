"use client";

import { AiTutorPanel } from "./tutor/AiTutorPanel";
import { BoardEvaluationPanel } from "./board/BoardEvaluationPanel";
import { ChessAnalysisForm } from "./analysis-form/ChessAnalysisForm";
import { ChessAnalysisProvider } from "../state/ChessAnalysisProvider";

export function ChessAnalysisExperience() {
  return (
    <ChessAnalysisProvider>
      <main className="min-h-screen bg-stone-50 px-4 py-6 text-zinc-950 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-6">
              <ChessAnalysisForm />
              <AiTutorPanel />
            </div>
            <BoardEvaluationPanel />
          </div>
        </div>
      </main>
    </ChessAnalysisProvider>
  );
}
