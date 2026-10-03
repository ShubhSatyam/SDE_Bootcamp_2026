import { describe, expect, it } from 'vitest';
import { evaluateExpression, parseExpression, tokenize } from './evaluate';

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

  it('builds a deterministic AST for precedence-sensitive expressions', () => {
    expect(parseExpression('2 + 3 × 4')).toEqual({
      type: 'binary',
      operator: '+',
      left: { type: 'number', value: 2 },
      right: {
        type: 'binary',
        operator: '×',
        left: { type: 'number', value: 3 },
        right: { type: 'number', value: 4 },
      },
    });
  });

  it.each([
    ['18+4×3=', '30'],
    ['10-2×3', '4'],
    ['-5+2', '-3'],
    ['3.5×2', '7'],
    ['.5+1.', '1.5'],
    ['(2+3)×4', '20'],
    ['10/4', '2.5'],
    ['8÷-2', '-4'],
    ['2×-3+5', '-1'],
    ['(1+2)×(3+4)', '21'],
    ['-(-3+5)', '-2'],
    ['3+4×5-2÷2', '22'],
  ])('evaluates %s as %s', (source, expected) => {
    expect(evaluateExpression(source)).toMatchObject({ ok: true, display: expected });
  });

  it.each([
    ['10÷0', { ok: false, display: 'Undefined' }],
    ['5÷(2-2)', { ok: false, display: 'Undefined' }],
    ['-1÷0', { ok: false, display: 'Undefined' }],
    ['0÷0', { ok: false, display: 'Undefined' }],
  ])('handles runtime division-by-zero for %s', (source, expected) => {
    expect(evaluateExpression(source)).toEqual(expected);
  });

  it.each([
    '',
    '1+',
    '1..2',
    '2(3)',
    '1=2',
    '1==',
    'NaN',
    '1e2',
    '()',
    '2 + * 3',
    '1 + (2',
    '1 + )2(',
    '((1+2)',
    '1 + = 2',
  ])('safely rejects malformed input %s', (source) => {
    expect(evaluateExpression(source)).toEqual({ ok: false, display: 'Invalid expression' });
  });
});
