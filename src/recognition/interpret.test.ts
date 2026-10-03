import { describe, expect, it } from 'vitest';
import { interpretRecognition, isSupportedMathExpression, normalizeMathText } from './interpret';

describe('recognition result handling', () => {
  it('converts model LaTeX output to calculator operators and evaluates it', () => {
    expect(interpretRecognition('18 + 4 \\times 3 =')).toEqual({
      expression: '18+4×3=',
      result: '30',
    });
  });

  it.each([
    ['18 + 4 × 3 =', '18+4×3=', '30'],
    ['10 - 2 × 3 =', '10-2×3=', '4'],
    ['3.5 × 2 =', '3.5×2=', '7'],
    ['−5 + 2 =', '-5+2=', '-3'],
    ['10 ÷ 0 =', '10÷0=', 'Undefined'],
  ])('interprets the full pipeline for %s', (input, expression, result) => {
    expect(interpretRecognition(input)).toEqual({ expression, result });
  });

  it('normalizes minus signs and fails safely on unsupported recognition', () => {
    expect(normalizeMathText('−5 + 2')).toBe('-5+2');
    expect(interpretRecognition('x + 2').result).toBe('Invalid expression');
  });

  it('maps supported model LaTeX to calculator tokens and rejects unsupported markup', () => {
    expect(normalizeMathText('3 \\cdot 4 \\div 2 \\minus 1.5 =')).toBe('3×4÷2-1.5=');
    expect(isSupportedMathExpression('3×4÷2-1.5=')).toBe(true);
    expect(normalizeMathText('8 * 2 / 4')).toBe('8×2÷4');
    expect(isSupportedMathExpression('\\frac{1}{2}')).toBe(false);
    expect(isSupportedMathExpression('')).toBe(false);
  });
});
