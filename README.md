# CalcInk

CalcInk is a private, offline-first handwriting calculator. Write an arithmetic expression on the digital-paper canvas and the app recognizes the handwritten formula, evaluates it safely, and paints the answer beside the writing.

## Features

- Pen, mouse, touch, and stylus input on a smooth high-DPI canvas.
- Stroke eraser, pixel eraser, undo/redo, clear, and adjustable ink width.
- Local handwriting-to-math recognition in a dedicated Web Worker.
- Deterministic expression parser for integers, decimals, unary signs, parentheses, and `+`, `−`, `×`, `÷`; operator precedence follows standard arithmetic rules.
- Safe handling for malformed input and division by zero (`Undefined`).
- Recognition is debounced after edits; erasing, undo, redo, and clearing all update the result.
- Offline-capable static deployment. No analytics, remote fonts, cloud APIs, or server inference.

## Architecture

```text
Pointer events
  → CSS-pixel stroke document
  → requestAnimationFrame canvas renderer (devicePixelRatio-aware)
  → debounced 384×384 ink image
  → Web Worker: Hugging Face Tokenizers.js + ONNX Runtime Web/WASM
  → Pix2Text-MFR LaTeX output → calculator tokens
  → tokenizer → recursive-descent evaluator
  → answer painted beside the handwritten expression
```

Drawing and rendering stay on the main thread and do not wait for recognition. Model loading and inference happen in a worker; stale results are ignored. The parser never uses `eval()` or dynamic code execution. The bounded stroke-history document is the source of truth for rendering, editing, and recognition preprocessing.

## Recognition model and attribution

- **Model:** [Pix2Text-MFR](https://huggingface.co/breezedeus/pix2text-mfr), pinned to revision [`bea257edb2653f2ae413b084f2ac0e8299d08df0`](https://huggingface.co/breezedeus/pix2text-mfr/tree/bea257edb2653f2ae413b084f2ac0e8299d08df0).
- **Task and output:** handwritten/printed mathematical formula image → LaTeX text. The bundled model card documents its formula-recognition purpose and limitations.
- **License:** the model repository identifies the model as MIT-licensed (`license:mit` in Hugging Face metadata). Pix2Text source: [breezedeus/Pix2Text](https://github.com/breezedeus/Pix2Text). Check those upstream terms before redistributing or modifying the weights.
- **Architecture:** TrOCR vision encoder-decoder fine-tuned on formula images. The pinned configuration specifies a DeiT image encoder (384×384 input, 16-pixel patches, 12 layers, hidden size 384) and a six-layer TrOCR decoder (hidden size 256, 1,200-token vocabulary). Its image processor uses 384×384 RGB inputs and normalization values of 0.5.
- **Browser format:** the pinned model revision publishes ONNX `encoder_model.onnx` and `decoder_model.onnx` exports, with tokenizer and processor configuration. CalcInk loads those exports directly with [ONNX Runtime Web](https://github.com/microsoft/onnxruntime), runs its encoder and autoregressive greedy decoder in the worker, and decodes output IDs with [Hugging Face Tokenizers.js](https://github.com/huggingface/tokenizers.js). The image is resized and normalized locally to the published processor's 384×384 RGB, mean-0.5/std-0.5 input.
- **Why selected:** unlike a general handwritten-text recognizer, this is an existing formula-recognition model trained to emit math markup; its upstream ONNX exports and permissive published license make local browser inference feasible.

The two ONNX files (about 118 MB total) and tokenizer/processor metadata are checked into `public/models/pix2text-mfr/`. The WASM runtime is bundled from the pinned npm dependency into the production assets and precached by the service worker. `npm run download:model` can restore the model files from their pinned upstream revision and verifies the ONNX SHA-256 checksums. Inference and tokenizer file access use only these local assets; there are no cloud APIs, remote model calls, or CDN requests.

### Offline operation

CalcInk is a static app. On the first online visit, wait for the service worker to finish caching the app and model, and for the local model status to become ready. The production build generates a precache manifest containing the complete app, ONNX weights, and WASM runtime. Subsequent visits can start and calculate without a network connection, subject to browser storage quota and service-worker support. Serve the app over HTTPS (or localhost); opening `index.html` as a `file://` URL does not enable workers or service workers.

Handwriting is kept in memory and is not uploaded or persisted. Reloading the page clears the current sheet.

## Setup and development

Requirements: Node.js 20+ and npm.

```sh
npm install
npm run dev
```

The model weights are included in the repository. To restore them after removing the model directory:

```sh
npm run download:model
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm test` | Run unit tests for parsing/evaluation, recognition output handling, coordinates, stroke erasure geometry, and history. |
| `npm run build` | Type-check, create the production bundle, and generate the offline precache service worker. |
| `npm run preview` | Serve the production build locally for deployment smoke checks. |
| `npm run download:model` | Download the pinned MIT-tagged model and copy local ONNX Runtime Web WASM files. |

## Production build and deployment

```sh
npm test
npm run build
npm run preview
```

Deploy the complete `dist/` directory to any static host that serves JavaScript modules, `.onnx`, `.wasm`, and `.webmanifest` files with suitable MIME types. Use HTTPS and serve at the site root (the service worker and local model URLs are root-relative). No application server, API endpoint, or runtime secrets are required. The build includes all model/runtime binaries, so the deployment is intentionally large.

## Tests

The Vitest suite covers tokenizer output, precedence, decimals, unary negatives, parentheses, division by zero, malformed input, CSS-pixel and high-DPI coordinate transforms, stroke hit testing, bounded undo/redo history, and recognition-output normalization/result handling.

## Known limitations

- Recognition is best-effort: handwriting style, symbol spacing, image aspect ratio, and ambiguous marks can cause misrecognition. Review the displayed transcription before relying on a result.
- This MFR model generates LaTeX rather than calibrated per-symbol confidence scores; CalcInk does not claim a confidence metric.
- The model and WASM assets are large and require a successful initial download and enough browser storage for offline caching.
- Service workers require a secure context and may be restricted by private-browsing/storage policies.
- The current parser intentionally supports arithmetic only; unsupported recognized markup is reported as an invalid expression, not executed.

## Engineering notes

The project keeps core math and stroke/history logic independent of React and browser services so they can be tested directly. Any recognition change must preserve the local-only model configuration, worker isolation, result staleness checks, offline precache, and parser safety tests. Model and runtime provenance are pinned in `scripts/download-model.mjs`; update those pins and this attribution together when refreshing assets.
