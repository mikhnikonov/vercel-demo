import type { ChessAnalysisResult } from "@/lib/chess/types";

type EvaluationBlockProps = {
  result: ChessAnalysisResult;
};

export function EvaluationBlock({ result }: EvaluationBlockProps) {
  return (
    <pre className="max-h-72 overflow-auto rounded-md bg-zinc-950 p-4 text-xs leading-5 text-zinc-50">
      {JSON.stringify(
        {
          finalPosition: result.positions.final,
          evaluations: result.evaluations.items.map((item) => ({
            ply: item.position.ply,
            move: item.position.san,
            fen: item.position.fen,
            eval: item.evaluation.eval,
            centipawns: item.evaluation.centipawns,
            mate: item.evaluation.mate,
            bestMove: item.evaluation.move,
            bestMoveSan: item.evaluation.san,
            depth: item.evaluation.depth,
            winChance: item.evaluation.winChance,
            text: item.evaluation.text,
            error: item.evaluation.error,
          })),
        },
        null,
        2
      )}
    </pre>
  );
}
