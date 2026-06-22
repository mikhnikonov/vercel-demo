import { useChessAnalysis } from "../../state/ChessAnalysisProvider";
import { getEngineFailureMessage } from "../../lib/analysis-diagnostics";

export function EngineHealthNotice() {
  const { diagnostics } = useChessAnalysis();
  const message = getEngineFailureMessage(diagnostics);

  if (!message) {
    return null;
  }

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
      <span className="font-semibold">Engine provider warning.</span> {message}
    </div>
  );
}
