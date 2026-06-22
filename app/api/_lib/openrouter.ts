import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const OPENROUTER_MODEL = "openrouter/free";

export function getOpenRouterModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return null;
  }

  return createOpenRouter({ apiKey })(OPENROUTER_MODEL);
}
