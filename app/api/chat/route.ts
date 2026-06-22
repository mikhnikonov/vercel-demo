import {
  convertToModelMessages,
  safeValidateUIMessages,
  streamText,
  type UIMessage,
} from "ai";
import { z } from "zod";

import { getOpenRouterModel } from "@/app/api/_lib/openrouter";
import { jsonError } from "@/app/api/_lib/responses";
import { readJsonBody } from "@/lib/http";

const TUTOR_SYSTEM_PROMPT = `You are a concise chess tutor. Format the response in Markdown. No yapping; keep it concise.

Do not grade the opponent's play except where it explains the player's opportunity or mistake. Focus on the player's game style, recurring decision patterns, and the mistakes they should train.

Treat the move classifications supplied by the user message as authoritative. Do not reclassify Good moves as mistakes just because they differ from the engine best move.`;

const CHAT_REQUEST_SCHEMA = z.object({
  messages: z.unknown(),
});

export const maxDuration = 30;

export async function POST(request: Request) {
  const model = getOpenRouterModel();

  if (!model) {
    return jsonError(
      "AI evaluation is not available because OPENROUTER_API_KEY is missing.",
      503
    );
  }

  const parsedBody = CHAT_REQUEST_SCHEMA.safeParse(
    await readJsonBody(request)
  );

  if (!parsedBody.success) {
    return jsonError("messages are required.", 400);
  }

  const validatedMessages = await safeValidateUIMessages<UIMessage>({
    messages: parsedBody.data.messages,
  });

  if (!validatedMessages.success) {
    return jsonError("Invalid chat messages.", 400);
  }

  const messages = validatedMessages.data;
  const result = streamText({
    maxOutputTokens: 700,
    messages: await convertToModelMessages(messages),
    model,
    system: TUTOR_SYSTEM_PROMPT,
    temperature: 0.2,
  });

  return result.toUIMessageStreamResponse({
    onError(error) {
      console.error("AI tutor stream failed", error);
      return "AI tutor failed to generate a response.";
    },
    originalMessages: messages,
  });
}
