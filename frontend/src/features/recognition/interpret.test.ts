import { describe, expect, it } from 'vitest';
import { formatCalculationAnswer, interpretRecognition, isSupportedMathExpression, normalizeMathText } from './interpret';

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
    ['10 ÷ O =', '10÷0=', 'Undefined'],
    ['10 ÷ o =', '10÷0=', 'Undefined'],
  ])('interprets the full pipeline for %s', (input, expression, result) => {
    expect(interpretRecognition(input)).toEqual({ expression, result });
  });

  it('normalizes minus signs and fails safely on unsupported recognition', () => {
    expect(normalizeMathText('−5 + 2')).toBe('-5+2');
    expect(normalizeMathText('O + 2')).toBe('0+2');
    expect(interpretRecognition('x + 2').result).toBe('Invalid expression');
  });

  it('maps supported model LaTeX to calculator tokens and rejects unsupported markup', () => {
    expect(normalizeMathText('3 \\cdot 4 \\div 2 \\minus 1.5 =')).toBe('3×4÷2-1.5=');
    expect(isSupportedMathExpression('3×4÷2-1.5=')).toBe(true);
    expect(normalizeMathText('8 * 2 / 4')).toBe('8×2÷4');
    expect(normalizeMathText('\\left(1+2\\right)\\times3')).toBe('(1+2)×3');
    expect(normalizeMathText('10 ÷ O =')).toBe('10÷0=');
    expect(isSupportedMathExpression('(1+2)×3')).toBe(true);
    expect(isSupportedMathExpression('10÷0=')).toBe(true);
    expect(isSupportedMathExpression('\\frac{1}{2}')).toBe(false);
    expect(isSupportedMathExpression('')).toBe(false);
  });

  it('formats the Live note answer without duplicating a recognized equals sign', () => {
    expect(formatCalculationAnswer('2+1=', '3')).toBe('2+1= 3');
    expect(formatCalculationAnswer('2+1', '3')).toBe('2+1 = 3');
  });
});
