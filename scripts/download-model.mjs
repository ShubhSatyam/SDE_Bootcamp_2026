import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../public/models/pix2text-mfr/', import.meta.url));
const revision = 'bea257edb2653f2ae413b084f2ac0e8299d08df0';
const base = `https://huggingface.co/breezedeus/pix2text-mfr/resolve/${revision}`;
const files = [
  ['config.json', 'config.json', 4556],
  ['generation_config.json', 'generation_config.json', 210],
  ['preprocessor_config.json', 'preprocessor_config.json', 450],
  ['special_tokens_map.json', 'special_tokens_map.json', 964],
  ['tokenizer.json', 'tokenizer.json', 39161],
  ['tokenizer_config.json', 'tokenizer_config.json', 1181],
  ['decoder_model.onnx', 'onnx/decoder_model.onnx', 30114937, 'fd0f92d7a012f3dae41e1ac79421aea0ea888b5a66cb3f9a004e424f82f3daed'],
  ['encoder_model.onnx', 'onnx/encoder_model.onnx', 87496990, 'bd8d5c322792e9ec45793af5569e9748f82a3d728a9e00213dbfc56c1486f37d'],
];

for (const [source, path, size, checksum] of files) {
  const destination = join(root, path);
  try {
    const currentSize = (await stat(destination)).size;
    if (currentSize === size) {
      if (!checksum || createHash('sha256').update(await readFile(destination)).digest('hex') === checksum) {
        console.log(`Already verified ${path}`);
        continue;
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const response = await fetch(`${base}/${source}`);
  if (!response.ok) throw new Error(`Model download failed (${response.status}): ${source}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength !== size) throw new Error(`Unexpected size for ${path}: ${bytes.byteLength}`);
  if (checksum && createHash('sha256').update(bytes).digest('hex') !== checksum) {
    throw new Error(`Checksum mismatch for ${path}`);
  }
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
  console.log(`Downloaded ${path} (${bytes.byteLength} bytes)`);
}
