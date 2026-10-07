import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Tokenizer } from '@huggingface/tokenizers';
import { describe, expect, it } from 'vitest';

const modelDirectory = resolve(process.cwd(), 'public', 'models', 'pix2text-mfr');
const tokenizer = new Tokenizer(
  JSON.parse(readFileSync(resolve(modelDirectory, 'tokenizer.json'), 'utf8')),
  JSON.parse(readFileSync(resolve(modelDirectory, 'tokenizer_config.json'), 'utf8')),
);

describe('bundled Pix2Text-MFR tokenizer', () => {
  it('encodes calculator expressions with the pinned model vocabulary', () => {
    expect(tokenizer.encode('18+4×3=').ids).toEqual([21, 28, 15, 24, 132, 250, 23, 33]);
  });

  it('decodes the pinned model output tokens into its original LaTeX form', () => {
    expect(tokenizer.decode([21, 474, 508, 274, 508, 333, 510, 312, 508, 270, 508], {
      skip_special_tokens: true,
    })).toBe('1 8 \\! + \\! 4 7 3 \\! = \\!');
  });
});
