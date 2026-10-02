# CalcInk architecture

## Runtime path

1. `DrawingCanvas` converts pointer positions to logical CSS pixels and records strokes separately from the device-pixel-ratio-scaled backing buffer.
2. A requestAnimationFrame loop renders committed and in-progress strokes. Pixel eraser strokes use destination-out compositing; stroke erasure removes hit-tested strokes from the document.
3. A committed edit schedules a debounced snapshot. `makeRecognitionImage` re-rasterizes ink in reading order onto a white 384×384 image, excluding the rendered answer.
4. The worker loads the repository-local Pix2Text-MFR ONNX encoder/decoder with ONNX Runtime Web and decodes output tokens with Hugging Face Tokenizers.js. It preprocesses the 384×384 image and performs autoregressive greedy decoding in the worker. Inference is serialized there; each request has an ID so results from an older document cannot overwrite newer work.
5. The LaTeX normalizer maps model operators to the app's arithmetic alphabet. A tokenizer and recursive-descent parser evaluate the expression without dynamic execution; the renderer places the displayed answer after the rightmost ink.

## Offline and deployment path

The service worker is registered before model initialization. The production build generates a precache list from the full `dist/` tree, including bundled ONNX Runtime WASM and all model files; activation waits for the cache to finish. The worker and model assets are same-origin static files, so after the first successful installation no network service participates in recognition or calculation.

## Module map

- `src/canvas/`: pointer canvas, coordinate transforms, stroke hit tests, rasterization, drawing renderer.
- `src/math/`: tokenizer and deterministic parser/evaluator.
- `src/recognition/`: model-text normalization and expression result handling.
- `src/workers/`: local-only ONNX inference worker.
- `src/hooks/`: worker lifecycle, edit debounce, and stale-result handling.
- `src/state/`: bounded stroke-history snapshots.
- `scripts/`: pinned model downloader/checksum verification and production precache generation.
