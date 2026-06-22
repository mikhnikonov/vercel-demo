import type { ChessAnalysisStatusResponse } from "@/lib/chess/types";

export function isFailedChessAnalysisStatus(
  status: ChessAnalysisStatusResponse["status"]
) {
  return status === "failed" || status === "cancelled";
}
