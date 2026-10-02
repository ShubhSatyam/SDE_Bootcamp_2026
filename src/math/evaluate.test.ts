import { describe, expect, it } from 'vitest';
import { evaluateExpression, tokenize } from './evaluate';

describe('math tokenizer and evaluator', () => {
  it('tokenizes integers, decimals, operators, and equals', () => {
    expect(tokenize('18 + 4.25×3=')).toEqual([
      { type: 'number', value: 18 },
      { type: 'operator', value: '+' },
      { type: 'number', value: 4.25 },
      { type: 'operator', value: '×' },
      { type: 'number', value: 3 },
      { type: 'equals' },
    ]);
  });

  it.each([
    ['18+4×3=', '30'],
    ['10-2×3', '4'],
    ['-5+2', '-3'],
    ['3.5×2', '7'],
    ['.5+1.', '1.5'],
    ['(2+3)×4', '20'],
    ['10/4', '2.5'],
  ])('evaluates %s as %s', (source, expected) => {
    expect(evaluateExpression(source)).toMatchObject({ ok: true, display: expected });
  });

  it('returns Undefined for division by zero', () => {
    expect(evaluateExpression('10÷0')).toEqual({ ok: false, display: 'Undefined' });
  });

  it.each(['', '1+', '1..2', '2(3)', '1=2', '1==', 'NaN', '1e2', '()'])(
    'safely rejects malformed input %s',
    (source) => {
      expect(evaluateExpression(source)).toEqual({ ok: false, display: 'Invalid expression' });
    },
  );
});
