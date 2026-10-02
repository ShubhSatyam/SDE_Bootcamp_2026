import { Tokenizer } from '@huggingface/tokenizers';
import * as ort from 'onnxruntime-web/wasm';
import wasmModuleUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url';
import wasmBinaryUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';

type WorkerRequest =
  | { type: 'initialize' }
  | { type: 'recognize'; id: number; image: Blob };

type WorkerReply =
  | { type: 'progress'; message: string }
  | { type: 'ready' }
  | { type: 'result'; id: number; text: string }
  | { type: 'error'; message: string };

let tokenizer: Tokenizer | undefined;
let encoder: ort.InferenceSession | undefined;
let decoder: ort.InferenceSession | undefined;
let inferenceQueue = Promise.resolve();

function reply(message: WorkerReply): void {
  self.postMessage(message);
}

function makePixelTensor(image: ImageData): ort.Tensor {
  if (image.width !== 384 || image.height !== 384) {
    throw new Error(`Expected a 384×384 RGB image, received ${image.width}×${image.height}`);
  }
  const planeSize = image.width * image.height;
  const pixels = new Float32Array(planeSize * 3);
  for (let pixel = 0; pixel < planeSize; pixel += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      pixels[channel * planeSize + pixel] = image.data[pixel * 4 + channel] / 127.5 - 1;
    }
  }
  return new ort.Tensor('float32', pixels, [1, 3, image.height, image.width]);
}

async function recognizeMath(imageBlob: Blob): Promise<string> {
  if (!tokenizer || !encoder || !decoder) throw new Error('The local recognition model is not ready');

  const bitmap = await createImageBitmap(imageBlob);
  try {
    const canvas = new OffscreenCanvas(384, 384);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Could not create the model input canvas');
    context.drawImage(bitmap, 0, 0, 384, 384);
    const image = context.getImageData(0, 0, 384, 384);
    const encoded = await encoder.run({ pixel_values: makePixelTensor(image) });
    const hiddenStates = encoded.last_hidden_state;
    if (!hiddenStates) throw new Error('The local model did not return encoder features');
    return await decodeTokens(hiddenStates);
  } finally {
    bitmap.close();
  }
}

async function decodeTokens(hiddenStates: ort.Tensor): Promise<string> {
  if (!tokenizer || !decoder) throw new Error('The local recognition model is not ready');

  const generated = [2];
  const eosTokenId = 2;
  for (let step = 0; step < 128; step += 1) {
    const inputIds = new BigInt64Array(generated.map(BigInt));
    const decoded = await decoder.run({
      input_ids: new ort.Tensor('int64', inputIds, [1, inputIds.length]),
      encoder_hidden_states: hiddenStates,
    });
    const logits = decoded.logits;
    if (!logits || !ArrayBuffer.isView(logits.data)) throw new Error('The local model returned invalid token scores');

    const vocabularySize = logits.dims[logits.dims.length - 1];
    const offset = (generated.length - 1) * vocabularySize;
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
    if (nextToken === eosTokenId) break;
    generated.push(nextToken);
  }
  return tokenizer.decode(generated.slice(1), { skip_special_tokens: true });
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
        const [tokenizerJsonResponse, tokenizerConfigResponse] = await Promise.all([
          fetch('/models/pix2text-mfr/tokenizer.json'),
          fetch('/models/pix2text-mfr/tokenizer_config.json'),
        ]);
        if (!tokenizerJsonResponse.ok || !tokenizerConfigResponse.ok) {
          throw new Error('Could not load the bundled math tokenizer');
        }
        [tokenizer, encoder, decoder] = await Promise.all([
          Promise.all([tokenizerJsonResponse.json(), tokenizerConfigResponse.json()])
            .then(([tokenizerJson, tokenizerConfig]) => new Tokenizer(tokenizerJson, tokenizerConfig)),
          ort.InferenceSession.create(`${modelPath}encoder_model.onnx`, options),
          ort.InferenceSession.create(`${modelPath}decoder_model.onnx`, options),
        ]);
        reply({ type: 'ready' });
        return;
      }

      const request = event.data;
      inferenceQueue = inferenceQueue.then(async () => {
        const text = await recognizeMath(request.image);
        reply({ type: 'result', id: request.id, text });
      }).catch((error: unknown) => {
        reply({ type: 'error', message: error instanceof Error ? error.message : 'Local recognition failed' });
      });
    } catch (error) {
      reply({ type: 'error', message: error instanceof Error ? error.message : 'Local recognition failed' });
    }
  })();
});
