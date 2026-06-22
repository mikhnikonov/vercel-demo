import type { ChessPositionEvaluation } from "@/lib/chess/types";
import { formatPercent } from "../../lib/analysis-progress";
import { Metric } from "../shared/Metric";

type EvaluationSummaryProps = {
  item: ChessPositionEvaluation;
};

export function EvaluationSummary({ item }: EvaluationSummaryProps) {
  const { evaluation, position } = item;

  return (
    <div className="rounded-md border border-zinc-200 p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-zinc-950">
          Ply {position.ply}: {position.san}
        </h3>
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {evaluation.available ? "Evaluated" : "Unavailable"}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <Metric
          label="Eval"
          value={evaluation.eval ?? evaluation.centipawns ?? "-"}
        />
        <Metric
          label="Win chance"
          value={formatPercent(evaluation.winChance)}
        />
        <Metric
          label="Best move"
          value={evaluation.san ?? evaluation.move ?? "-"}
        />
        <Metric label="Mate" value={evaluation.mate ?? "-"} />
      </dl>
      {evaluation.text ? (
        <p className="mt-3 leading-6 text-zinc-700">{evaluation.text}</p>
      ) : null}
      {evaluation.error ? (
        <p className="mt-3 leading-6 text-red-700">{evaluation.error}</p>
      ) : null}
    </div>
  );
}
