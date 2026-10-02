export type MathToken =
  | { type: 'number'; value: number }
  | { type: 'operator'; value: '+' | '-' | '×' | '÷' }
  | { type: 'left-paren' }
  | { type: 'right-paren' }
  | { type: 'equals' };

export type Evaluation =
  | { ok: true; value: number; display: string }
  | { ok: false; display: 'Undefined' | 'Invalid expression' };

export function tokenize(source: string): MathToken[] {
  const tokens: MathToken[] = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      const match = source.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
      if (!match) throw new Error('Invalid number');
      const value = Number(match[0]);
      if (!Number.isFinite(value)) throw new Error('Invalid number');
      tokens.push({ type: 'number', value });
      index += match[0].length;
      continue;
    }
    if (char === '+' || char === '-' || char === '×' || char === '÷' || char === '*' || char === '/') {
      const value = char === '*' ? '×' : char === '/' ? '÷' : char;
      tokens.push({ type: 'operator', value });
      index += 1;
      continue;
    }
    if (char === '(') tokens.push({ type: 'left-paren' });
    else if (char === ')') tokens.push({ type: 'right-paren' });
    else if (char === '=') tokens.push({ type: 'equals' });
    else throw new Error('Unsupported character');
    index += 1;
  }

  return tokens;
}

class Parser {
  private cursor = 0;

  constructor(private readonly tokens: MathToken[]) {}

  parse(): number {
    const result = this.expression();
    if (this.peek()?.type === 'equals') this.cursor += 1;
    if (this.cursor !== this.tokens.length) throw new Error('Unexpected token');
    return result;
  }

  private expression(): number {
    let value = this.term();
    while (this.peek()?.type === 'operator' && (this.peek() as Extract<MathToken, { type: 'operator' }>).value.match(/^[+-]$/)) {
      const operator = (this.tokens[this.cursor++] as Extract<MathToken, { type: 'operator' }>).value;
      const right = this.term();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  }

  private term(): number {
    let value = this.unary();
    while (this.peek()?.type === 'operator' && ['×', '÷'].includes((this.peek() as Extract<MathToken, { type: 'operator' }>).value)) {
      const operator = (this.tokens[this.cursor++] as Extract<MathToken, { type: 'operator' }>).value;
      const right = this.unary();
      if (operator === '÷' && right === 0) throw new DivisionByZeroError();
      value = operator === '×' ? value * right : value / right;
    }
    return value;
  }

  private unary(): number {
    const next = this.peek();
    if (next?.type === 'operator' && (next.value === '+' || next.value === '-')) {
      this.cursor += 1;
      const value = this.unary();
      return next.value === '-' ? -value : value;
    }
    if (next?.type === 'left-paren') {
      this.cursor += 1;
      const value = this.expression();
      if (this.peek()?.type !== 'right-paren') throw new Error('Missing closing parenthesis');
      this.cursor += 1;
      return value;
    }
    if (next?.type !== 'number') throw new Error('Expected number');
    this.cursor += 1;
    return next.value;
  }

  private peek(): MathToken | undefined {
    return this.tokens[this.cursor];
  }
}

class DivisionByZeroError extends Error {}

export function evaluateExpression(source: string): Evaluation {
  try {
    const tokens = tokenize(source);
    if (tokens.length === 0) return { ok: false, display: 'Invalid expression' };
    const equals = tokens.filter((token) => token.type === 'equals');
    if (equals.length > 1 || (equals.length === 1 && tokens[tokens.length - 1]?.type !== 'equals')) {
      return { ok: false, display: 'Invalid expression' };
    }
    const value = new Parser(tokens).parse();
    if (!Number.isFinite(value)) return { ok: false, display: 'Invalid expression' };
    const rounded = Number(value.toPrecision(12));
    return { ok: true, value: rounded, display: Object.is(rounded, -0) ? '0' : String(rounded) };
  } catch (error) {
    if (error instanceof DivisionByZeroError) return { ok: false, display: 'Undefined' };
    return { ok: false, display: 'Invalid expression' };
  }
}
