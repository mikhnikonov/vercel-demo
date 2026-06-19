import type { FormEvent } from "react";

import { StatusLine } from "./StatusLine";
import type { AiTutorPhase, ChessAnalysisRequestState } from "../types";

type ChessAnalysisFormProps = {
  isBusy: boolean;
  onPgnChange: (pgn: string) => void;
  onSubmit: () => void;
  pgn: string;
  state: ChessAnalysisRequestState;
  tutorPhase: AiTutorPhase;
};

export function ChessAnalysisForm({
  isBusy,
  onPgnChange,
  onSubmit,
  pgn,
  state,
  tutorPhase,
}: ChessAnalysisFormProps) {
  function submitPgn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
          Chess tutor pipeline
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
          PGN analysis flow
        </h1>
      </div>

      <form className="space-y-3" onSubmit={submitPgn}>
        <label className="block text-sm font-medium text-zinc-700" htmlFor="pgn">
          PGN
        </label>
        <textarea
          id="pgn"
          className="min-h-[360px] w-full resize-y rounded-md border border-zinc-300 bg-white px-4 py-3 font-mono text-sm leading-6 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10"
          value={pgn}
          onChange={(event) => onPgnChange(event.target.value)}
          spellCheck={false}
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-md bg-zinc-950 px-5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
            disabled={isBusy}
            type="submit"
          >
            {isBusy ? "Running" : "Run workflow"}
          </button>
          <StatusLine state={state} tutorPhase={tutorPhase} />
        </div>
      </form>
    </section>
  );
}
