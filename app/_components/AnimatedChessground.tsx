'use client';

import { useEffect, useRef } from 'react';
import { Chessground } from 'chessground/chessground';
import { read as readFen } from 'chessground/fen';
import type { Api } from 'chessground/api';
import type { Config } from 'chessground/config';
import type { Color, FEN, Key, Piece } from 'chessground/types';

type Props = {
  fen: FEN;
  width?: number | string;
  height?: number | string;
  config?: Config;
  className?: string;
};

type PieceOnSquare = {
  key: Key;
  piece: Piece;
};

const DEFAULT_ANIMATION_DURATION = 100;

export default function AnimatedChessground({
  fen,
  width = 320,
  height = 320,
  config,
  className,
}: Props) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<Api | null>(null);
  const previousFenRef = useRef<FEN | null>(null);
  const initialFenRef = useRef(fen);
  const initialConfigRef = useRef(config);

  useEffect(() => {
    if (!boardRef.current) return;

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

    if (!api || previousFen === fen) return;

    const inferredMove = previousFen ? inferMove(previousFen, fen) : undefined;
    if (inferredMove) {
      api.move(inferredMove[0], inferredMove[1]);
      api.set({ turnColor: activeColorFromFen(fen) });
    } else {
      api.set({
        fen,
        turnColor: activeColorFromFen(fen),
        lastMove: undefined,
      });
    }

    previousFenRef.current = fen;
  }, [fen]);

  return (
    <div
      className={className}
      ref={boardRef}
      style={{
        width,
        height,
      }}
    />
  );
}

function withStreamDefaults(config?: Config): Config {
  return {
    ...config,
    viewOnly: config?.viewOnly ?? true,
    coordinates: config?.coordinates ?? true,
    highlight: {
      lastMove: true,
      check: true,
      ...config?.highlight,
    },
    animation: {
      enabled: true,
      duration: DEFAULT_ANIMATION_DURATION,
      ...config?.animation,
    },
    movable: {
      free: false,
      showDests: false,
      ...config?.movable,
    },
    draggable: {
      enabled: false,
      ...config?.draggable,
    },
    selectable: {
      enabled: false,
      ...config?.selectable,
    },
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

    if (samePiece(previousPiece, nextPiece)) continue;
    if (previousPiece) removed.push({ key, piece: previousPiece });
    if (nextPiece) added.push({ key, piece: nextPiece });
  }

  if (added.length !== 1 || (removed.length !== 1 && removed.length !== 2)) {
    return undefined;
  }

  const destination = added[0];
  const origin = removed.find(
    ({ key, piece }) => key !== destination.key && samePiece(piece, destination.piece)
  );
  const capturedOnDestination = removed.find(({ key }) => key === destination.key);

  if (!origin) return undefined;
  if (removed.length === 2 && !capturedOnDestination) return undefined;

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

  if (activeColor === 'w') return 'white';
  if (activeColor === 'b') return 'black';

  return undefined;
}
