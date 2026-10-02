import { describe, expect, it } from 'vitest';
import { interpretRecognition, normalizeMathText } from './interpret';

describe('recognition result handling', () => {
  it('converts model LaTeX output to calculator operators and evaluates it', () => {
    expect(interpretRecognition('18 + 4 \\times 3 =')).toEqual({
      expression: '18+4×3=',
      result: '30',
    });
  });

  it('normalizes minus signs and fails safely on unsupported recognition', () => {
    expect(normalizeMathText('−5 + 2')).toBe('-5+2');
    expect(interpretRecognition('x + 2').result).toBe('Invalid expression');
  });
});
