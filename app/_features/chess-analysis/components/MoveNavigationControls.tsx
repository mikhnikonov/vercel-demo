type MoveNavigationControlsProps = {
  canGoNext: boolean;
  canGoPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
};

export function MoveNavigationControls({
  canGoNext,
  canGoPrevious,
  onNext,
  onPrevious,
}: MoveNavigationControlsProps) {
  return (
    <div className="flex justify-center gap-3">
      <button
        aria-label="Previous move"
        className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-zinc-300 bg-white text-lg font-semibold text-zinc-950 shadow-sm transition hover:border-zinc-500 hover:bg-zinc-50 active:translate-y-px active:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-300 disabled:hover:bg-white disabled:active:translate-y-0 disabled:active:bg-white"
        disabled={!canGoPrevious}
        onClick={onPrevious}
        type="button"
      >
        {"<"}
      </button>
      <button
        aria-label="Next move"
        className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-zinc-300 bg-white text-lg font-semibold text-zinc-950 shadow-sm transition hover:border-zinc-500 hover:bg-zinc-50 active:translate-y-px active:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-300 disabled:hover:bg-white disabled:active:translate-y-0 disabled:active:bg-white"
        disabled={!canGoNext}
        onClick={onNext}
        type="button"
      >
        {">"}
      </button>
    </div>
  );
}
