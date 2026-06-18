'use client';

import { useChat } from '@ai-sdk/react';
import { useState } from 'react';

export default function ChatPage() {
    const [input, setInput] = useState('');
    const { messages, sendMessage } = useChat();

    return (
        <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
            <section className="w-full max-w-2xl space-y-5">
                <div className="max-h-[55vh] min-h-32 space-y-3 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    {messages.map(message => (
                        <div key={message.id} className="text-sm leading-6">
                            <strong className="capitalize text-zinc-900 dark:text-zinc-100">
                                {message.role}:{' '}
                            </strong>
                            {message.parts.map((part, index) =>
                                part.type === 'text' ? <span key={index}>{part.text}</span> : null
                            )}
                        </div>
                    ))}
                </div>

                <form
                    className="flex w-full flex-col gap-3 sm:flex-row"
                    onSubmit={e => {
                        e.preventDefault();
                        sendMessage({ text: input });
                        setInput('');
                    }}
                >
                    <input
                        className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
                        placeholder="Type a message"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                    />
                    <button
                        className="rounded-lg bg-zinc-950 px-6 py-3 text-base font-medium text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-zinc-900/20 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300 dark:focus:ring-zinc-100/20"
                        type="submit"
                    >
                        Send
                    </button>
                </form>
            </section>
        </main>
    );
}
