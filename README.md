# CalcInk

CalcInk is a private, offline-first handwriting calculator. Write an arithmetic expression on the digital-paper canvas and the app recognizes the handwritten formula, evaluates it safely, and paints the answer beside the writing.

## Repository layout

- `frontend/`: the complete client-side application, including its source, public model assets, build/test tooling, and scripts.
- `README.md`, `ARCHITECTURE.md`, and `.gitignore`: project documentation and repository-level configuration.

CalcInk has no backend: recognition and calculation run locally in the browser, with no application server or API.

## Features

- Pen, mouse, touch, and stylus input on a smooth high-DPI canvas.
- Stroke eraser, pixel eraser, undo/redo, clear, and adjustable ink width.
- Create, rename, switch between, and delete multiple notes; titles and handwriting are saved in this browser.
- Local handwriting-to-math recognition in a dedicated Web Worker.
- Deterministic expression parser for integers, decimals, unary signs, parentheses, and `+`, `−`, `×`, `÷`; operator precedence follows standard arithmetic rules.
- Safe handling for malformed input and division by zero (`Undefined`).
- Recognition is debounced after edits; erasing, undo, redo, and clearing all update the result.
- Offline-capable static deployment. No analytics, remote fonts, cloud APIs, or server inference.

## Source layout

```text
frontend/src/
├── app/                    # App component and browser entry point
├── features/
│   ├── calculator/         # Expression tokenizer, parser, and evaluator
│   ├── canvas/             # Drawing UI, geometry, coordinates, and painting
│   └── recognition/        # Recognition logic, hook, and worker
├── state/                  # Stroke history and browser-local notes
├── styles/                 # Global application styles
└── types/                  # Shared TypeScript types
```

Tests are colocated with the modules they cover. Static model and PWA assets are in `frontend/public/`; build and model scripts are in `frontend/scripts/`.

## Architecture

```text
Pointer events
  → CSS-pixel stroke document
  → requestAnimationFrame canvas renderer (devicePixelRatio-aware)
  → debounced stroke snapshot
  → Web Worker: 384×384 preprocessing + Hugging Face Tokenizers.js + ONNX Runtime Web/WASM
  → Pix2Text-MFR LaTeX output → calculator tokens
  → tokenizer → recursive-descent evaluator
  → answer painted beside the handwritten expression
```

Drawing and rendering stay on the main thread and do not wait for recognition. Stroke rasterization, image normalization, model loading, token decoding, and inference happen in a worker; stale results are ignored. The parser never uses `eval()` or dynamic code execution. The bounded stroke-history document is the source of truth for rendering, editing, and worker-side recognition preprocessing.

## Recognition model and attribution

- **Model:** [Pix2Text-MFR](https://huggingface.co/breezedeus/pix2text-mfr), pinned to revision [`bea257edb2653f2ae413b084f2ac0e8299d08df0`](https://huggingface.co/breezedeus/pix2text-mfr/tree/bea257edb2653f2ae413b084f2ac0e8299d08df0).
- **Task and output:** the pinned model card describes mathematical formula recognition, including handwritten formulas, and emits LaTeX text. It also warns that results may be poor on images outside its formula training domain.
- **License:** the pinned Hugging Face model metadata and model card both declare MIT (`license:mit`). Model source and weights: [breezedeus/pix2text-mfr](https://huggingface.co/breezedeus/pix2text-mfr/tree/bea257edb2653f2ae413b084f2ac0e8299d08df0); project source: [breezedeus/Pix2Text](https://github.com/breezedeus/Pix2Text).
- **Architecture:** the pinned `config.json` identifies `VisionEncoderDecoderModel`: a DeiT image encoder (384×384 image size, 16×16 patches, 12 layers, hidden size 384) and a TrOCR decoder (6 layers, model width 256, vocabulary size 1,200). The model card says it was initialized from TrOCR and retrained on mathematical formula images.
- **Input contract:** the pinned `preprocessor_config.json` specifies RGB, 384×384 resize, rescaling by 1/255, then per-channel mean 0.5 and standard deviation 0.5. CalcInk preserves the drawing aspect ratio inside a white square, renders ink dark and pixel erasures white, then sends normalized NCHW float32 `[1, 3, 384, 384]` values. This is the same numerical normalization as `(pixel / 127.5) - 1`.
- **Output contract:** the pinned repository includes ONNX `encoder_model.onnx` and `decoder_model.onnx` plus tokenizer files. The encoder takes `pixel_values` and returns `last_hidden_state`; the decoder takes `input_ids` and `encoder_hidden_states` and returns per-position vocabulary `logits`. Worker-side greedy autoregressive decoding starts from the configured decoder-start token and stops at EOS (or the configured 512-token generation ceiling). Token IDs are decoded with the bundled tokenizer into the model's LaTeX text output.
- **Token and confidence handling:** the postprocessor maps the model's `\times`/`\cdot`, `\div`, and `\minus` spellings to `×`, `÷`, and `-`, then accepts only `0–9`, `+`, `-`, `×`, `÷`, `.`, and `=`. Unsupported markup or invalid expressions fail safely without showing an answer. The worker reports the mean softmax probability of its selected output tokens; it is a model-score heuristic, **not a calibrated probability of correctness**. Results below the conservative 0.35 heuristic cutoff are withheld and the user is prompted to rewrite the expression.
- **Offline/browser suitability:** this exact revision publishes the two ONNX graph files and tokenizer/processor metadata, so it runs with ONNX Runtime Web's WASM execution provider. CalcInk bundles these assets and the runtime locally; all preprocessing and inference execute in a Web Worker. Runtime model, tokenizer, and WASM loads are same-origin local assets; there are no runtime cloud/API requests.

The two ONNX files (about 118 MB total) and tokenizer/processor metadata are checked into `frontend/public/models/pix2text-mfr/`. The WASM runtime is bundled from the pinned npm dependency into the production assets and precached by the service worker. Run `npm run download:model` from `frontend/` to restore the model files from their pinned upstream revision and verify the ONNX SHA-256 checksums. Inference and tokenizer file access use only these local assets; there are no cloud APIs, remote model calls, or CDN requests.

### Offline operation

CalcInk is a static app. On the first online visit, wait for the service worker to finish caching the app and model, and for the local model status to become ready. The production build generates a precache manifest containing the complete app, ONNX weights, and WASM runtime. Subsequent visits can start and calculate without a network connection, subject to browser storage quota and service-worker support. Serve the app over HTTPS (or localhost); opening `index.html` as a `file://` URL does not enable workers or service workers.

Note titles and handwriting are saved in this browser’s local storage and are not uploaded. Notes remain available after a reload on the same browser and device; they do not sync to other browsers or devices.

### Network dependency audit

The app has no external runtime network dependency:

- Local ONNX model files live in `frontend/public/models/pix2text-mfr/` and are loaded from same-origin URLs only.
- The tokenizer metadata and generation config are fetched from the app's local `frontend/public/models/...` directory at runtime.
- ONNX Runtime Web's WASM runtime is bundled from the npm dependency and precached by the generated service worker.
- There are no API calls, no remote configuration fetches, and no third-party CDN scripts or fonts.
- The app uses a system font stack only; there are no `@import` rules or remote web-font requests.
- The service worker is necessary for reliable offline reload because the app's model and runtime assets are large and must be cached first.

### Exact offline verification steps

1. From the repository root, install dependencies and build the production bundle:

   ```sh
   cd frontend
   npm install
   npm run build
   ```

2. Serve the built app locally:

   ```sh
   npm run preview -- --host 0.0.0.0 --port 4173
   ```

3. Open `http://localhost:4173/` in a browser and wait for the app to show `Ready, works offline` in the status banner.

4. Open DevTools → Application/Storage → Service Workers and verify the service worker is active for the origin.

5. In DevTools → Network, turn on `Offline` mode and disable cache if desired. Refresh the page once.

6. Confirm all of the following:
   - the app still renders the interface
   - no failed fetches appear for the app shell or model assets
   - the model status remains ready
   - drawing and recognition continue to work without a network connection

7. Optional browser-level check: while offline, open the console and confirm `navigator.serviceWorker.controller !== null` and that the only fetches are same-origin cached responses.

This verification is only valid on an HTTP localhost or HTTPS deployment; direct `file://` loading is not an offline-supported browser environment for service workers.

## Setup and development

Requirements: Node.js 20+ and npm.

```sh
cd frontend
npm install
npm run dev
```

The model weights are included in `frontend/public/models/pix2text-mfr/`. To restore them after removing the model directory, run this from `frontend/`:

```sh
npm run download:model
```

## Scripts

Run all npm commands from `frontend/`.

| Script                   | Purpose                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`            | Start the Vite development server (run from `frontend/`).                                                              |
| `npm test`               | Run unit tests for parsing/evaluation, recognition output handling, coordinates, stroke erasure geometry, and history. |
| `npm run build`          | Type-check, create the production bundle, and generate the offline precache service worker.                            |
| `npm run preview`        | Serve the production build locally for deployment smoke checks.                                                        |
| `npm run download:model` | Download the pinned MIT-tagged model and copy local ONNX Runtime Web WASM files.                                       |

## Production build and deployment

```sh
cd frontend
npm test
npm run build
npm run preview
```

Deploy the complete `frontend/dist/` directory to any static host that serves JavaScript modules, `.onnx`, `.wasm`, and `.webmanifest` files with suitable MIME types. Use HTTPS and serve at the site root (the service worker and local model URLs are root-relative). No application server, API endpoint, or runtime secrets are required. The build includes all model/runtime binaries, so the deployment is intentionally large.

## Tests

The Vitest suite covers tokenizer output, precedence, decimals, unary negatives, parentheses, division by zero, malformed input, CSS-pixel and high-DPI coordinate transforms, stroke hit testing, bounded undo/redo history, and recognition-output normalization/result handling.

## Known limitations

- Recognition is best-effort: handwriting style, symbol spacing, image aspect ratio, and ambiguous marks can cause misrecognition. Review the displayed transcription before relying on a result.
- The reported sequence score is derived from decoder logits and is not calibrated; ambiguous or out-of-vocabulary expressions are withheld.
- The model and WASM assets are large and require a successful initial download and enough browser storage for offline caching.
- Service workers require a secure context and may be restricted by private-browsing/storage policies.
- The current parser intentionally supports arithmetic only; unsupported recognized markup is reported as an invalid expression, not executed.

## Engineering notes

The project keeps core math and stroke/history logic independent of React and browser services so they can be tested directly. Any recognition change must preserve the local-only model configuration, worker isolation, result staleness checks, offline precache, and parser safety tests. Model and runtime provenance are pinned in `frontend/scripts/download-model.mjs`; update those pins and this attribution together when refreshing assets.
