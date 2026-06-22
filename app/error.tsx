"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4 text-zinc-950">
      <section className="w-full max-w-md rounded-md border border-red-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-red-700">
          Chess Tutor
        </p>
        <h1 className="mt-2 text-xl font-semibold">Something went wrong.</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          The analysis screen failed to render. Retry the route before starting
          a new PGN analysis.
        </p>
        <button
          className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800"
          onClick={() => unstable_retry()}
          type="button"
        >
          Retry
        </button>
      </section>
    </main>
  );
}
