import { Tokenizer } from '@huggingface/tokenizers';
import * as ort from 'onnxruntime-web/wasm';
import wasmModuleUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url';
import wasmBinaryUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';
import type { Stroke } from '../types/strokes';

type WorkerRequest =
  | { type: 'initialize' }
  | { type: 'recognize'; id: number; strokes: Stroke[] };

type WorkerReply =
  | { type: 'progress'; message: string }
  | { type: 'ready' }
  | { type: 'result'; id: number; text: string; confidence: number }
  | { type: 'error'; id?: number; message: string };

type GenerationConfig = {
  decoder_start_token_id: number;
  eos_token_id: number;
  max_new_tokens: number;
};

let tokenizer: Tokenizer | undefined;
let encoder: ort.InferenceSession | undefined;
let decoder: ort.InferenceSession | undefined;
let generationConfig: GenerationConfig | undefined;
let inferenceQueue = Promise.resolve();
const inputSize = 384;

function reply(message: WorkerReply): void {
  self.postMessage(message);
}

function makeRecognitionTensor(strokes: Stroke[]): ort.Tensor {
  const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (const stroke of strokes) {
    for (const point of stroke.points) {
      bounds.left = Math.min(bounds.left, point.x);
      bounds.top = Math.min(bounds.top, point.y);
      bounds.right = Math.max(bounds.right, point.x);
      bounds.bottom = Math.max(bounds.bottom, point.y);
    }
  }
  if (!Number.isFinite(bounds.left)) throw new Error('There is no handwriting to recognize');
  const canvas = new OffscreenCanvas(inputSize, inputSize);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Could not create the model input canvas');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, inputSize, inputSize);
  const margin = 22;
  const contentWidth = Math.max(1, bounds.right - bounds.left + margin * 2);
  const contentHeight = Math.max(1, bounds.bottom - bounds.top + margin * 2);
  const scale = Math.min(
    (inputSize - 2 * margin) / contentWidth,
    (inputSize - 2 * margin) / contentHeight,
  );
  const offsetX = (inputSize - contentWidth * scale) / 2 - (bounds.left - margin) * scale;
  const offsetY = (inputSize - contentHeight * scale) / 2 - (bounds.top - margin) * scale;

  context.save();
  context.translate(offsetX, offsetY);
  context.scale(scale, scale);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    context.globalCompositeOperation = 'source-over';
    context.strokeStyle = stroke.mode === 'pixel-eraser' ? '#ffffff' : '#171717';
    context.fillStyle = context.strokeStyle;
    context.lineWidth = stroke.mode === 'pixel-eraser' ? stroke.width * 3 : stroke.width;
    context.beginPath();
    context.moveTo(stroke.points[0].x, stroke.points[0].y);
    if (stroke.points.length === 1) {
      context.lineTo(stroke.points[0].x + 0.01, stroke.points[0].y + 0.01);
    } else {
      for (let index = 1; index < stroke.points.length; index += 1) {
        context.lineTo(stroke.points[index].x, stroke.points[index].y);
      }
    }
    context.stroke();
  }
  context.restore();

  const image = context.getImageData(0, 0, inputSize, inputSize);
  const planeSize = inputSize * inputSize;
  const pixels = new Float32Array(planeSize * 3);
  for (let pixel = 0; pixel < planeSize; pixel += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      pixels[channel * planeSize + pixel] = image.data[pixel * 4 + channel] / 127.5 - 1;
    }
  }
  return new ort.Tensor('float32', pixels, [1, 3, inputSize, inputSize]);
}

function selectedTokenConfidence(logits: ort.Tensor, offset: number, vocabularySize: number, tokenId: number): number {
  let maximum = Number.NEGATIVE_INFINITY;
  for (let token = 0; token < vocabularySize; token += 1) {
    const score = Number(logits.data[offset + token]);
    if (Number.isNaN(score) || score === Number.POSITIVE_INFINITY) {
      throw new Error('The local model produced invalid token scores');
    }
    maximum = Math.max(maximum, score);
  }
  let denominator = 0;
  for (let token = 0; token < vocabularySize; token += 1) {
    denominator += Math.exp(Number(logits.data[offset + token]) - maximum);
  }
  return Math.exp(Number(logits.data[offset + tokenId]) - maximum) / denominator;
}

async function recognizeMath(strokes: Stroke[]): Promise<{ text: string; confidence: number }> {
  if (!tokenizer || !encoder || !decoder || !generationConfig) {
    throw new Error('The local recognition model is not ready');
  }

  const encoded = await encoder.run({ pixel_values: makeRecognitionTensor(strokes) });
  const hiddenStates = encoded.last_hidden_state;
  if (!hiddenStates) throw new Error('The local model did not return encoder features');

  const generated = [generationConfig.decoder_start_token_id];
  const confidences: number[] = [];
  let reachedEndToken = false;
  for (let step = 0; step < generationConfig.max_new_tokens; step += 1) {
    const inputIds = new BigInt64Array(generated.map(BigInt));
    const decoded = await decoder.run({
      input_ids: new ort.Tensor('int64', inputIds, [1, inputIds.length]),
      encoder_hidden_states: hiddenStates,
    });
    const logits = decoded.logits;
    if (!logits || !ArrayBuffer.isView(logits.data) || logits.dims.length !== 3) {
      throw new Error('The local model returned invalid token scores');
    }

    const vocabularySize = logits.dims[2];
    const offset = (logits.dims[1] - 1) * vocabularySize;
    let nextToken = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let token = 0; token < vocabularySize; token += 1) {
      const score = Number(logits.data[offset + token]);
      if (score > bestScore) {
        bestScore = score;
        nextToken = token;
      }
    }

    if (!Number.isFinite(bestScore)) throw new Error('The local model produced invalid token scores');
    if (nextToken === generationConfig.eos_token_id) {
      reachedEndToken = true;
      break;
    }
    confidences.push(selectedTokenConfidence(logits, offset, vocabularySize, nextToken));
    generated.push(nextToken);
  }

  if (!reachedEndToken) throw new Error('The model output exceeded its configured generation limit');
  if (generated.length === 1) throw new Error('The model did not recognize any symbols');
  const text = tokenizer.decode(generated.slice(1), { skip_special_tokens: true });
  if (!text.trim()) throw new Error('The model did not recognize any symbols');
  const confidence = confidences.reduce((sum, value) => sum + value, 0) / confidences.length;
  return { text, confidence };
}

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  void (async () => {
    try {
      if (event.data.type === 'initialize') {
        reply({ type: 'progress', message: 'Loading the local math recognizer…' });
        const runtime = ort.env.wasm;
        runtime.wasmPaths = { mjs: wasmModuleUrl, wasm: wasmBinaryUrl };
        runtime.numThreads = 1;
        const modelPath = '/models/pix2text-mfr/onnx/';
        const options: ort.InferenceSession.SessionOptions = { executionProviders: ['wasm'] };
        const [tokenizerJsonResponse, tokenizerConfigResponse, generationConfigResponse] = await Promise.all([
          fetch('/models/pix2text-mfr/tokenizer.json'),
          fetch('/models/pix2text-mfr/tokenizer_config.json'),
          fetch('/models/pix2text-mfr/generation_config.json'),
        ]);
        if (!tokenizerJsonResponse.ok || !tokenizerConfigResponse.ok || !generationConfigResponse.ok) {
          throw new Error('Could not load the bundled model configuration');
        }
        const loadedGenerationConfig = await generationConfigResponse.json() as GenerationConfig;
        if (
          !Number.isInteger(loadedGenerationConfig.decoder_start_token_id)
          || !Number.isInteger(loadedGenerationConfig.eos_token_id)
          || !Number.isInteger(loadedGenerationConfig.max_new_tokens)
          || loadedGenerationConfig.max_new_tokens <= 0
        ) {
          throw new Error('The bundled model has an invalid generation configuration');
        }
        [tokenizer, encoder, decoder] = await Promise.all([
          Promise.all([tokenizerJsonResponse.json(), tokenizerConfigResponse.json()])
            .then(([tokenizerJson, tokenizerConfig]) => new Tokenizer(tokenizerJson, tokenizerConfig)),
          ort.InferenceSession.create(`${modelPath}encoder_model.onnx`, options),
          ort.InferenceSession.create(`${modelPath}decoder_model.onnx`, options),
        ]);
        generationConfig = loadedGenerationConfig;
        reply({ type: 'ready' });
        return;
      }

      const request = event.data;
      inferenceQueue = inferenceQueue.then(async () => {
        try {
          const result = await recognizeMath(request.strokes);
          reply({ type: 'result', id: request.id, ...result });
        } catch (error) {
          reply({
            type: 'error',
            id: request.id,
            message: error instanceof Error ? error.message : 'Local recognition failed',
          });
        }
      });
    } catch (error) {
      reply({ type: 'error', message: error instanceof Error ? error.message : 'Local recognition failed' });
    }
  })();
});
