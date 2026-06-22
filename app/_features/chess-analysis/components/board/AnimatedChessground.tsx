"use client";

import { useEffect, useRef } from "react";
import { Chessground } from "chessground/chessground";
import { read as readFen } from "chessground/fen";
import type { Api } from "chessground/api";
import type { Config } from "chessground/config";
import type { Color, FEN, Key, Piece } from "chessground/types";

type AnimatedChessgroundProps = {
  className?: string;
  config?: Config;
  fen: FEN;
  height?: number | string;
  width?: number | string;
};

type PieceOnSquare = {
  key: Key;
  piece: Piece;
};

const DEFAULT_ANIMATION_DURATION = 100;

export function AnimatedChessground({
  className,
  config,
  fen,
  height = 320,
  width = 320,
}: AnimatedChessgroundProps) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<Api | null>(null);
  const previousFenRef = useRef<FEN | null>(null);
  const initialConfigRef = useRef(config);
  const initialFenRef = useRef(fen);

  useEffect(() => {
    if (!boardRef.current) {
      return;
    }

    const api = Chessground(boardRef.current, {
      ...withStreamDefaults(initialConfigRef.current),
      fen: initialFenRef.current,
      turnColor: activeColorFromFen(initialFenRef.current),
    });

    apiRef.current = api;
    previousFenRef.current = initialFenRef.current;

    return () => {
      api.destroy();
      apiRef.current = null;
      previousFenRef.current = null;
    };
  }, []);

  useEffect(() => {
    apiRef.current?.set(withStreamDefaults(config));
  }, [config]);

  useEffect(() => {
    const api = apiRef.current;
    const previousFen = previousFenRef.current;

    if (!api || previousFen === fen) {
      return;
    }

    const inferredMove = previousFen ? inferMove(previousFen, fen) : undefined;

    if (inferredMove) {
      api.move(inferredMove[0], inferredMove[1]);
      api.set({ turnColor: activeColorFromFen(fen) });
    } else {
      api.set({
        fen,
        lastMove: undefined,
        turnColor: activeColorFromFen(fen),
      });
    }

    previousFenRef.current = fen;
  }, [fen]);

  return (
    <div
      className={className}
      ref={boardRef}
      style={{
        height,
        width,
      }}
    />
  );
}

function withStreamDefaults(config?: Config): Config {
  return {
    ...config,
    animation: {
      enabled: true,
      duration: DEFAULT_ANIMATION_DURATION,
      ...config?.animation,
    },
    draggable: {
      enabled: false,
      ...config?.draggable,
    },
    highlight: {
      check: true,
      lastMove: true,
      ...config?.highlight,
    },
    movable: {
      free: false,
      showDests: false,
      ...config?.movable,
    },
    selectable: {
      enabled: false,
      ...config?.selectable,
    },
    viewOnly: config?.viewOnly ?? true,
  };
}

function inferMove(previousFen: FEN, nextFen: FEN): [Key, Key] | undefined {
  const previousPieces = readFen(previousFen);
  const nextPieces = readFen(nextFen);
  const changedKeys = new Set<Key>([
    ...previousPieces.keys(),
    ...nextPieces.keys(),
  ]);
  const removed: PieceOnSquare[] = [];
  const added: PieceOnSquare[] = [];

  for (const key of changedKeys) {
    const previousPiece = previousPieces.get(key);
    const nextPiece = nextPieces.get(key);

    if (samePiece(previousPiece, nextPiece)) {
      continue;
    }

    if (previousPiece) {
      removed.push({ key, piece: previousPiece });
    }

    if (nextPiece) {
      added.push({ key, piece: nextPiece });
    }
  }

  // Chessground can animate ordinary moves from origin/destination.
  // Position changes like castling or promotion fall back to a direct FEN set.
  if (added.length !== 1 || (removed.length !== 1 && removed.length !== 2)) {
    return undefined;
  }

  const destination = added[0];
  const origin = removed.find(
    ({ key, piece }) =>
      key !== destination.key && samePiece(piece, destination.piece)
  );
  const capturedOnDestination = removed.find(
    ({ key }) => key === destination.key
  );

  if (!origin) {
    return undefined;
  }

  if (removed.length === 2 && !capturedOnDestination) {
    return undefined;
  }

  return [origin.key, destination.key];
}

function samePiece(a?: Piece, b?: Piece): boolean {
  return (
    a?.role === b?.role &&
    a?.color === b?.color &&
    Boolean(a?.promoted) === Boolean(b?.promoted)
  );
}

function activeColorFromFen(fen: FEN): Color | undefined {
  const activeColor = fen.trim().split(/\s+/)[1];

  if (activeColor === "w") {
    return "white";
  }

  if (activeColor === "b") {
    return "black";
  }

  return undefined;
}
