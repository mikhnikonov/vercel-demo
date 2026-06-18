import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';

const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
});

export async function GET() {
    const { text } = await generateText({
        model: openrouter('openrouter/free'),
        prompt: 'Explain OpenRouter in one paragraph.',
    });

    return Response.json({ text });
}