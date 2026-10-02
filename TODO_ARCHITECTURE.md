# CalcInk build plan

1. Establish a small Vite + TypeScript + React app and test/build scripts.
2. Implement a pointer-driven, high-DPI canvas with stroke history, erasing, redraw, and answer projection.
3. Verify and bundle a genuinely pretrained, open-license handwriting/math model; run recognition in a local Web Worker with no runtime network dependency.
4. Add a safe tokenizer/parser/evaluator and connect recognition updates to answer rendering.
5. Cover math, coordinate/history, and recognition-state behavior with automated tests.
6. Document model provenance, offline operation, setup, architecture, deployment, and limitations; verify tests and production build.

## Architecture

Pointer input → normalized stroke document → independent canvas renderer → debounced snapshot → local preprocessing/model inference in a Web Worker → recognized expression → deterministic evaluator → answer rendered alongside terminal `=`.
