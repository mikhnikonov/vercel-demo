import type { ChessAnalysisStreamResponseEvent } from "@/lib/chess-analysis-types";

export async function consumeWorkflowUpdates(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: ChessAnalysisStreamResponseEvent) => void
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      buffer = parseBufferedWorkflowUpdates(buffer, onEvent);
    }

    buffer += decoder.decode();
    parseBufferedWorkflowUpdates(`${buffer}\n`, onEvent);
  } finally {
    reader.releaseLock();
  }
}

export function parseBufferedWorkflowUpdates(
  buffer: string,
  onEvent: (event: ChessAnalysisStreamResponseEvent) => void
) {
  let nextBuffer = buffer;
  let newlineIndex = nextBuffer.indexOf("\n");

  while (newlineIndex >= 0) {
    const line = nextBuffer.slice(0, newlineIndex).trim();
    nextBuffer = nextBuffer.slice(newlineIndex + 1);

    if (line) {
      onEvent(JSON.parse(line) as ChessAnalysisStreamResponseEvent);
    }

    newlineIndex = nextBuffer.indexOf("\n");
  }

  return nextBuffer;
}

export async function readStartErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as { error?: unknown };

    if (typeof data.error === "string") {
      return data.error;
    }
  } catch {
    // Fall through to the generic message below.
  }

  return "Unable to start workflow.";
}
