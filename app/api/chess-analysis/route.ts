import { getRun, start, type Run } from "workflow/api";

import { CHESS_ANALYSIS_STREAM_NAMESPACE } from "@/lib/chess-analysis-types";
import type {
  ChessAnalysisStreamResponseEvent,
  ChessAnalysisResult,
  ChessAnalysisStatusResponse,
  ChessAnalysisWorkflowStreamEvent,
} from "@/lib/chess-analysis-types";
import { analyzePgnWorkflow } from "@/workflows/chess-analysis";

export const maxDuration = 30;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    pgn?: unknown;
  } | null;
  const pgn = typeof body?.pgn === "string" ? body.pgn.trim() : "";

  if (!pgn) {
    return Response.json({ error: "PGN is required." }, { status: 400 });
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
  const runId = searchParams.get("runId");

  if (!runId) {
    return Response.json({ error: "runId is required." }, { status: 400 });
  }

  const run = getRun<ChessAnalysisResult>(runId);

  if (!(await run.exists)) {
    return Response.json({ error: "Workflow run not found." }, { status: 404 });
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

      async function watchTerminalStatus() {
        try {
          while (!closed) {
            const status = await run.status;

            if (status === "failed" || status === "cancelled") {
              enqueue({ type: "status", runId: run.runId, status });
              close();
              await reader?.cancel().catch(() => undefined);
              return;
            }

            await delay(1000);
          }
        } catch (error) {
          enqueue({
            type: "error",
            runId: run.runId,
            message:
              error instanceof Error ? error.message : "Unable to watch run.",
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
        } catch (error) {
          enqueue({
            type: "error",
            runId: run.runId,
            message: error instanceof Error ? error.message : "Stream failed.",
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

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
