# Chess Tutor

Chess Tutor is a Next.js App Router prototype for analyzing a PGN, streaming engine progress to the UI, and generating a concise AI coaching summary for the selected player side.

## Starting Points

- `app/page.tsx` renders the chess analysis experience.
- `app/_features/chess-analysis/components/ChessAnalysisExperience.tsx` owns the page layout.
- `app/_features/chess-analysis/state/ChessAnalysisProvider.tsx` is the single client-side source of truth for PGN input, workflow state, board playback, selected side, tutor phase, and engine diagnostics.
- `app/api/chess-analysis/route.ts` starts and polls the workflow-backed engine analysis.
- `app/api/chat/route.ts` streams the AI tutor response through the Vercel AI SDK.
- `workflows/chess-analysis.ts` parses PGN positions, calls `chess-api.com`, and emits progress events.

## Runtime Requirements

- The AI tutor uses OpenRouter through `@openrouter/ai-sdk-provider`.
- `OPENROUTER_API_KEY` is required for the AI tutor/evaluation route. Set it in `.env.local` for local development or in the deployment environment before running the tutor:

  ```bash
  OPENROUTER_API_KEY=your_openrouter_api_key
  ```

- Without `OPENROUTER_API_KEY`, engine analysis can still run, but `POST /api/chat` returns `503` and the AI tutor panel reports that AI evaluation is not available.
- Engine evaluations are requested from `https://chess-api.com/v1`.
- The app uses Next.js `16`, React `19`, AI SDK `6`, `workflow`, `chess.js`, and `@react-chess/chessground`.

## Data Flow

1. The user edits a PGN in `ChessAnalysisForm`.
2. `ChessAnalysisProvider` exposes the form state and `startAnalysis()` action to the feature UI.
3. `useChessAnalysisRun` posts the PGN to `POST /api/chess-analysis`.
4. The route validates the PGN with `lib/chess/pgn.ts`, starts `analyzePgnWorkflow`, and returns an NDJSON stream of workflow updates.
5. The workflow parses positions with `lib/chess/pgn.ts`, evaluates each position through `lib/chess/chess-api.ts`, and writes position/evaluation events to the workflow stream.
6. `useChessAnalysisRun` consumes streamed events for live progress and polls `GET /api/chess-analysis?runId=...` until the workflow returns the final result.
7. `ChessAnalysisProvider` derives engine diagnostics from progress/result data. Chess-api failures are visible in `EngineHealthNotice`.
8. `BoardEvaluationPanel` replays the parsed PGN and shows the matching engine evaluation for the current board position.
9. `AiTutorPanel` converts the completed engine result into a compact game summary and sends it to `POST /api/chat`.
10. `app/api/chat/route.ts` validates UI messages with `safeValidateUIMessages`, converts them with `convertToModelMessages`, and returns `streamText(...).toUIMessageStreamResponse()`.

## File Architecture

```text
app/
  api/
    _lib/
      openrouter.ts                   Server-only OpenRouter model factory.
      responses.ts                    API-only JSON response helpers.
    chat/route.ts                     AI tutor streaming endpoint using the Vercel AI SDK.
    chess-analysis/route.ts           Workflow start/status endpoint and NDJSON progress stream.
  _features/
    chess-analysis/
      components/
        ChessAnalysisExperience.tsx   Feature layout and provider mount.
        analysis-form/
          ChessAnalysisForm.tsx       PGN textarea and submit action.
          EngineHealthNotice.tsx      User-facing chess-api partial/failure notice.
          StatusLine.tsx              Engine and AI tutor status display.
        board/
          AnimatedChessground.tsx     Chessground wrapper with FEN updates and simple move animation.
          BoardEvaluationPanel.tsx    Board playback, side selection, current eval, raw JSON details.
          BoardSideSwitch.tsx         White/black reviewed-side selector.
          EvaluationBlock.tsx         Compact debug view of final engine output.
          EvaluationSummary.tsx       Current-position eval metrics.
          MoveNavigationControls.tsx  Previous/next move controls.
        shared/
          Metric.tsx                  Small `<dt>/<dd>` metric component.
        tutor/
          AiTutorPanel.tsx            Builds and streams the tutor review after analysis completes.
      config/constants.ts             Sample PGN and board playback timing.
      hooks/useChessAnalysisRun.ts    Client workflow submission, stream consumption, and polling state.
      lib/
        analysis-diagnostics.ts       Engine provider failure summaries for UI notices.
        analysis-progress.ts          Progress/result projection helpers for the UI.
        analysis-run-state.ts         Pure workflow stream reducer used by `useChessAnalysisRun`.
        game-summary.ts               Move classification and tutor prompt construction.
        pgn-playback.ts               Feature wrapper around shared PGN parsing.
        workflow-stream.ts            NDJSON stream reader for workflow events.
      state/
        ChessAnalysisProvider.tsx     React context boundary for feature state/actions.
      types.ts                        Client-only chess analysis UI state types.
  error.tsx                           Route-level fallback for unexpected render/runtime errors.
  globals.css                         Tailwind import and global app surface styles.
  layout.tsx                          Root metadata, fonts, chessground CSS imports.
  page.tsx                            Home route.
lib/
  async.ts                            Shared async primitives such as delay/backoff waits.
  chess/
    chess-api.ts                      chess-api.com request, retry, and response normalization boundary.
    pgn.ts                            Shared PGN-to-position parser and starting FEN.
    types.ts                          Shared workflow/API/UI domain types.
    workflow-status.ts                Shared chess-analysis workflow status predicates.
  http.ts                             Shared request/response JSON body and JSON error-message helpers.
workflows/
  chess-analysis.ts                   Durable workflow for PGN parsing, engine calls, and result assembly.
next.config.ts                        Next config wrapped with `withWorkflow`.
package.json                          Runtime dependencies and npm scripts.
postcss.config.mjs                    Tailwind/PostCSS integration.
tsconfig.json                         TypeScript, Next, and workflow compiler configuration.
```

## Boundaries

- `app/api/**` is server-only HTTP boundary code. Keep provider keys, request validation, and response shaping here.
- `workflows/**` is long-running analysis work. Keep external engine calls and workflow stream writes here.
- `lib/chess/**` is shared chess domain code. Provider-specific quirks belong in `chess-api.ts`; PGN parsing belongs in `pgn.ts`; shared types belong in `types.ts`.
- `app/_features/chess-analysis/state/**` owns feature-level React context. Components should read state/actions from `useChessAnalysis()`.
- `app/_features/chess-analysis/components/**` is presentation and interaction UI. Components should not call provider APIs directly.
- `app/_features/chess-analysis/lib/**` contains UI-facing projections: progress, diagnostics, game summaries, and stream parsing.

## Error Handling

- Expected input errors are returned by `POST /api/chess-analysis` before a workflow starts.
- Chess-api provider failures are stored as unavailable evaluations, kept in the result, and surfaced through `EngineHealthNotice`.
- The workflow can complete with partial engine data. The tutor summary skips moves that do not have adjacent engine evaluations.
- Missing `OPENROUTER_API_KEY` is handled as an expected `POST /api/chat` configuration error and surfaced in `AiTutorPanel`.
- Unexpected UI/runtime errors fall through to `app/error.tsx`, which provides a route-level retry.

## AI SDK Usage

The tutor route intentionally uses AI SDK primitives instead of hand-parsing chat state:

- `safeValidateUIMessages` validates the incoming `useChat` payload.
- `convertToModelMessages` creates provider-ready messages.
- `streamText` streams the tutor answer.
- `toUIMessageStreamResponse({ originalMessages })` keeps message IDs stable and masks server errors before they reach the client.

## Development

```bash
npm install --legacy-peer-deps
npm run dev
```

Then open `http://localhost:3000`.
