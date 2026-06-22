import type { ChessAnalysisStreamResponseEvent } from "@/lib/chess/types";
import { getJsonErrorMessage, readJsonBody } from "@/lib/http";

export async function consumeWorkflowUpdates(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: ChessAnalysisStreamResponseEvent) => void
) {
  // Workflow progress is NDJSON, so chunks can split in the middle of an event.
  // Buffer partial lines until a newline completes the JSON payload.
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
  // Return the unparsed tail so the next network chunk can complete it.
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
  return getJsonErrorMessage(
    await readJsonBody(response),
    "Unable to start workflow."
  );
}
