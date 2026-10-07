# CalcInk architecture

## Runtime path

1. `DrawingCanvas` converts pointer positions to logical CSS pixels and records strokes separately from the device-pixel-ratio-scaled backing buffer.
2. A requestAnimationFrame loop renders committed and in-progress strokes. Pixel eraser strokes use destination-out compositing; stroke erasure removes hit-tested strokes from the document.
3. A committed edit schedules a debounced snapshot. `makeRecognitionImage` re-rasterizes ink in reading order onto a white 384×384 image, excluding the rendered answer.
4. The worker loads the repository-local Pix2Text-MFR ONNX encoder/decoder with ONNX Runtime Web and decodes output tokens with Hugging Face Tokenizers.js. It preprocesses the 384×384 image and performs autoregressive greedy decoding in the worker. Inference is serialized there; each request has an ID so results from an older document cannot overwrite newer work.
5. The LaTeX normalizer maps model operators to the app's arithmetic alphabet. A tokenizer and recursive-descent parser evaluate the expression without dynamic execution; the renderer places the displayed answer after the rightmost ink.

## Offline and deployment path

The service worker is registered before model initialization. The production build generates a precache list from the full `frontend/dist/` tree, including bundled ONNX Runtime WASM and all model files; activation waits for the cache to finish. The worker and model assets are same-origin static files, so after the first successful installation no network service participates in recognition or calculation.

## Module map

- `frontend/src/app/`: React application entry point and top-level interface.
- `frontend/src/features/canvas/`: drawing component, coordinates, stroke geometry, and canvas rendering; tests stay beside the code they cover.
- `frontend/src/features/calculator/`: tokenizer, parser, and arithmetic evaluator.
- `frontend/src/features/recognition/`: model-text interpretation, recognition hook, and local ONNX inference worker.
- `frontend/src/state/`: bounded stroke-history snapshots.
- `frontend/src/state/notes.ts`: browser-local note persistence and note management.
- `frontend/src/styles/`: application styles.
- `frontend/src/types/`: shared stroke and point types, plus the ONNX Runtime type declaration.
- `frontend/public/`: static app assets and local model files.
- `frontend/scripts/`: pinned model downloader/checksum verification and production precache generation.
- `frontend/` also contains the frontend package manifests and Vite/TypeScript/Vitest/ESLint configuration.

CalcInk is a client-only application; it has no backend service or API.
