# CalcInk

CalcInk is a browser-based handwriting calculator that lets a user draw arithmetic on a digital paper canvas, recognizes the expression locally, evaluates it safely, and auto-writes the result back into the same page.

This project is intentionally client-only: the UI, canvas logic, stroke history, calculator engine, and local ONNX model inference all run in the browser without a backend service.

## Repository structure

```text
SDE_Bootcamp_2026/
├── ARCHITECTURE.md
├── README.md
├── .gitignore
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── public/
│   │   ├── manifest.webmanifest
│   │   ├── sw.js
│   │   └── models/
│   │       └── pix2text-mfr/
│   │           ├── config.json
│   │           ├── generation_config.json
│   │           ├── preprocessor_config.json
│   │           ├── tokenizer.json
│   │           ├── tokenizer_config.json
│   │           ├── special_tokens_map.json
│   │           └── onnx/
│   │               ├── encoder_model.onnx
│   │               └── decoder_model.onnx
│   ├── scripts/
│   │   ├── download-model.mjs
│   │   └── write-service-worker.mjs
│   └── src/
│       ├── app/
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── features/
│       │   ├── calculator/
│       │   │   ├── evaluate.ts
│       │   │   └── evaluate.test.ts
│       │   ├── canvas/
│       │   │   ├── components/
│       │   │   ├── autoWriteFonts.ts
│       │   │   ├── coordinates.ts
│       │   │   ├── geometry.ts
│       │   │   ├── paint.ts
│       │   │   └── *.test.ts
│       │   └── recognition/
│       │       ├── interpret.ts
│       │       ├── interpret.test.ts
│       │       ├── hooks/
│       │       └── workers/
│       ├── state/
│       │   ├── StrokeHistory.ts
│       │   ├── StrokeHistory.test.ts
│       │   └── notes.ts
│       ├── styles/
│       │   └── styles.css
│       └── types/
│           ├── onnxruntime-wasm.d.ts
│           └── strokes.ts
└── ARCHITECTURE.md
```

## Core features

- Handwriting input with pen, mouse, touch, and stylus support
- High-DPI canvas rendering with stroke and pixel erasing
- Multi-note support with local browser storage persistence
- Undo, redo, clear, and adjustable ink width controls
- Local recognition through a dedicated Web Worker
- Deterministic parser/evaluator for arithmetic expressions
- Safe handling for malformed expressions and division-by-zero results
- Auto-write option to paint the computed answer directly onto the paper
- Offline-first static deployment with a generated service worker cache

## Tech stack

- React + TypeScript + Vite for the app shell and UI
- ONNX Runtime Web + Hugging Face Tokenizers for local model inference
- Vitest for unit testing
- Service worker precache for app and model assets

## Runtime architecture

The current application flow is:

1. Pointer events are converted to logical CSS-pixel positions and stored as strokes.
2. A requestAnimationFrame render loop draws the stroke history onto a high-DPI canvas.
3. Changed strokes are debounced and sent to a recognition worker as a normalized image snapshot.
4. The worker loads the local Pix2Text-MFR ONNX encoder/decoder and tokenizers from the app bundle.
5. The model output is normalized from LaTeX/MathML-like text into supported calculator tokens.
6. A recursive-descent parser evaluates the expression safely without `eval()`.
7. The result is rendered back onto the paper, and the live notepad reflects the recognized expression and answer.

The key design decision is separation of concerns: the main thread handles drawing and editing, while the worker owns model load, preprocessing, and inference. This keeps the UI responsive and prevents stale recognition from overwriting newer results.

## Calculator engine

The arithmetic evaluator is implemented in `frontend/src/features/calculator/evaluate.ts`.

It supports:

- integers and decimals
- unary `+` and `-`
- parentheses
- precedence-aware multiplication/division before addition/subtraction
- division by zero as `Undefined`
- invalid input as `Invalid expression`

This logic is deliberately deterministic and tested directly with Vitest.

## Recognition flow

The recognition pipeline lives under `frontend/src/features/recognition/`:

- `interpret.ts`: text cleanup and normalization of model output
- `hooks/useRecognition.ts`: debounced worker coordination and stale-result filtering
- `workers/recognition.worker.ts`: local inference and tokenizer decoding logic

The recognizer accepts only supported arithmetic symbols and rejects unsupported output cleanly instead of executing unsafe text.

## State and persistence

- `frontend/src/state/StrokeHistory.ts` keeps bounded history for undo/redo
- `frontend/src/state/notes.ts` saves note titles and strokes in browser local storage
- `frontend/src/app/App.tsx` connects the canvas, notes, recognition state, and toolbar actions

## Offline model assets

The model is bundled inside the app and loaded from local static files, not a remote API.

Relevant directories:

- `frontend/public/models/pix2text-mfr/`
- `frontend/scripts/download-model.mjs`
- `frontend/scripts/write-service-worker.mjs`

The generated service worker precaches the app bundle and model runtime so the project can continue functioning offline after its first successful load.

## Development

Requirements:

- Node.js 20+
- npm

Setup:

```bash
cd frontend
npm install
npm run dev
```

Useful commands:

```bash
cd frontend
npm test
npm run build
npm run preview
npm run download:model
```

## Testing

The project includes focused unit tests for:

- calculator parsing and evaluation
- recognition normalization and results
- canvas rendering and handwriting sizing
- stroke geometry and erasing behavior
- stroke history and undo/redo

Run the suite with:

```bash
cd frontend
npm test
```

## Notes

- There is no backend or API server in this repository.
- The app is designed for local, same-origin execution and offline use after initial install.
- The architecture and runtime behavior are documented in more detail in `ARCHITECTURE.md`.
