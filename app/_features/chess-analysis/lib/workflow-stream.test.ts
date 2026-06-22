import { describe, expect, it } from "vitest";

import type { ChessAnalysisStreamResponseEvent } from "@/lib/chess/types";
import { parseBufferedWorkflowUpdates } from "./workflow-stream";

describe("parseBufferedWorkflowUpdates", () => {
  it("emits complete NDJSON events and returns an incomplete tail", () => {
    const events: ChessAnalysisStreamResponseEvent[] = [];
    const tail = parseBufferedWorkflowUpdates(
      '{"type":"started","runId":"run-1","status":"running"}\n{"type":"status"',
      (event) => events.push(event)
    );

    expect(events).toEqual([
      {
        runId: "run-1",
        status: "running",
        type: "started",
      },
    ]);
    expect(tail).toBe('{"type":"status"');
  });

  it("combines a previous tail with the next chunk", () => {
    const events: ChessAnalysisStreamResponseEvent[] = [];

    parseBufferedWorkflowUpdates(
      '{"type":"status","runId":"run-1","status":"completed"}\n',
      (event) => events.push(event)
    );

    expect(events).toEqual([
      {
        runId: "run-1",
        status: "completed",
        type: "status",
      },
    ]);
  });
});
