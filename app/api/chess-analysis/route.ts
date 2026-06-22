import { getRun, start, type Run } from "workflow/api";
import { z } from "zod";

import { jsonError } from "@/app/api/_lib/responses";
import { delay } from "@/lib/async";
import { parsePgnPositions } from "@/lib/chess/pgn";
import { CHESS_ANALYSIS_STREAM_NAMESPACE } from "@/lib/chess/types";
import { isFailedChessAnalysisStatus } from "@/lib/chess/workflow-status";
import { readJsonBody } from "@/lib/http";
import type {
  ChessAnalysisStreamResponseEvent,
  ChessAnalysisResult,
  ChessAnalysisStatusResponse,
  ChessAnalysisWorkflowStreamEvent,
} from "@/lib/chess/types";
import { analyzePgnWorkflow } from "@/workflows/chess-analysis";

export const maxDuration = 30;

const START_ANALYSIS_SCHEMA = z.object({
  pgn: z.string().trim().min(1, "PGN is required."),
});

export async function POST(request: Request) {
  const parsedBody = START_ANALYSIS_SCHEMA.safeParse(
    await readJsonBody(request)
  );

  if (!parsedBody.success) {
    return jsonError("PGN is required.", 400);
  }

  const pgn = parsedBody.data.pgn;
  const parsedPgn = parsePgnPositions(pgn);

  if (parsedPgn.error) {
    return jsonError(`The PGN could not be parsed: ${parsedPgn.error}`, 400);
  }

  if (parsedPgn.positions.length < 2) {
    return jsonError("The PGN did not contain any moves to analyze.", 400);
  }

  const run = await start(analyzePgnWorkflow, [{ pgn }]);

  return new Response(createRunUpdateStream(run), {
    status: 202,
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "application/x-ndjson; charset=utf-8",
    },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId")?.trim();

  if (!runId) {
    return jsonError("runId is required.", 400);
  }

  const run = getRun<ChessAnalysisResult>(runId);

  if (!(await run.exists)) {
    return jsonError("Workflow run not found.", 404);
  }

  const status = await run.status;
  const response: ChessAnalysisStatusResponse = { runId, status };

  if (status === "completed") {
    response.result = await run.returnValue;
  }

  return Response.json(response);
}

function createRunUpdateStream(
  run: Run<ChessAnalysisResult>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let closed = false;
  let reader:
    | ReadableStreamDefaultReader<ChessAnalysisWorkflowStreamEvent>
    | undefined;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      reader = run
        .getReadable<ChessAnalysisWorkflowStreamEvent>({
          namespace: CHESS_ANALYSIS_STREAM_NAMESPACE,
        })
        .getReader();

      function enqueue(event: ChessAnalysisStreamResponseEvent) {
        if (closed) {
          return;
        }

        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      }

      function close() {
        if (closed) {
          return;
        }

        closed = true;
        controller.close();
      }

      // The workflow stream carries progress events; terminal failures are
      // observed separately from run.status so the client is not left polling.
      async function watchTerminalStatus() {
        try {
          while (!closed) {
            const status = await run.status;

            if (isFailedChessAnalysisStatus(status)) {
              enqueue({ type: "status", runId: run.runId, status });
              close();
              await reader?.cancel().catch(() => undefined);
              return;
            }

            await delay(1000);
          }
        } catch {
          enqueue({
            type: "error",
            runId: run.runId,
            message: "Unable to watch workflow status.",
          });
          close();
          await reader?.cancel().catch(() => undefined);
        }
      }

      async function readWorkflowEvents() {
        try {
          enqueue({
            type: "started",
            runId: run.runId,
            status: await run.status,
          });
          void watchTerminalStatus();

          while (!closed && reader) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            enqueue({ ...value, runId: run.runId });
          }
        } catch {
          enqueue({
            type: "error",
            runId: run.runId,
            message: "Workflow stream failed.",
          });
        } finally {
          close();
        }
      }

      void readWorkflowEvents();
    },
    cancel() {
      closed = true;
      return reader?.cancel();
    },
  });
}
