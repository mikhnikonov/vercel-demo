import type { BoardSide } from "../types";

type BoardSideSwitchProps = {
  side: BoardSide;
  onSideChange: (side: BoardSide) => void;
};

const BOARD_SIDES: BoardSide[] = ["white", "black"];

export function BoardSideSwitch({ side, onSideChange }: BoardSideSwitchProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-zinc-700">
        I played this game as
      </span>
      <div
        aria-label="I played this game as"
        className="inline-flex rounded-md border border-zinc-300 bg-white p-1"
        role="group"
      >
        {BOARD_SIDES.map((candidate) => {
          const selected = candidate === side;

          return (
            <button
              aria-pressed={selected}
              className={
                selected
                  ? "h-8 cursor-pointer rounded bg-zinc-950 px-3 text-sm font-medium capitalize text-white transition hover:bg-zinc-900 active:translate-y-px active:bg-zinc-800"
                  : "h-8 cursor-pointer rounded px-3 text-sm font-medium capitalize text-zinc-700 transition hover:bg-zinc-100 active:translate-y-px active:bg-zinc-200"
              }
              key={candidate}
              onClick={() => onSideChange(candidate)}
              type="button"
            >
              {candidate}
            </button>
          );
        })}
      </div>
    </div>
  );
}
