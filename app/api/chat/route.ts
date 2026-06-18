import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { convertToModelMessages, streamText, type UIMessage } from 'ai';

const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(req: Request) {
    const { messages }: { messages: UIMessage[] } = await req.json();

    const result = streamText({
        // Free random model router:
        model: openrouter('openrouter/free'),

        // Or choose a specific model:
        // model: openrouter('meta-llama/llama-3.2-3b-instruct:free'),
        // model: openrouter('google/gemini-2.5-flash'),

        messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
}