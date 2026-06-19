import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { convertToModelMessages, streamText, type UIMessage } from 'ai';

const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
});

const TUTOR_SYSTEM_PROMPT = `You are a concise chess tutor. Format the response in Markdown. No yapping; keep it concise.

Do not grade the opponent's play except where it explains the player's opportunity or mistake. Focus on the player's game style, recurring decision patterns, and the mistakes they should train.

Use these classification rules:
- bestMove: the engine best move from the previous position equals the played move.
- goodMove: from the moving side's perspective, the eval stayed level or improved.
- mistake: from the moving side's perspective, the eval dropped by less than 1 pawn.
- blunder: the player missed a forced mate, or the eval dropped by 1 pawn or more.`;

export async function POST(req: Request) {
    const { messages }: { messages: UIMessage[] } = await req.json();

    const result = streamText({
        // Free random model router:
        model: openrouter('openrouter/free'),
        system: TUTOR_SYSTEM_PROMPT,

        // Or choose a specific model:
        // model: openrouter('meta-llama/llama-3.2-3b-instruct:free'),
        // model: openrouter('google/gemini-2.5-flash'),

        messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
}