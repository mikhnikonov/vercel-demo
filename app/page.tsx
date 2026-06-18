'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useEffect } from 'react';
import AnimatedChessground from './components/AnimatedChessground';

const FEN_STREAM = [
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1',
    'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2',
    'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq c3 0 2',
];

export default function ChatPage() {
    const [input, setInput] = useState('');
    const { messages, sendMessage } = useChat();
    const [fenIndex, setFenIndex] = useState(0);
    const fen = FEN_STREAM[fenIndex];

    useEffect(() => {
        const interval = setInterval(() => {
            setFenIndex(current => (current + 1) % FEN_STREAM.length);
        }, 500);

        return () => clearInterval(interval);
    }, []);

    return (
        <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
            <section className="w-full max-w-2xl space-y-5">
                {messages.length > 0 && (
                    <div
                        className="max-h-[55vh] space-y-3 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
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
                )}

                <form
                    className="flex w-full flex-col gap-3 sm:flex-row"
                    onSubmit={e => {
                        e.preventDefault();
                        sendMessage({text: input});
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
                <AnimatedChessground fen={fen} width={320} height={320}/>
            </section>
        </main>
    );
}
