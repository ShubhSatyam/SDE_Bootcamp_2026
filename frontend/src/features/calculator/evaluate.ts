export type MathOperator = '+' | '-' | '×' | '÷';

export type MathToken =
  | { type: 'number'; value: number }
  | { type: 'operator'; value: MathOperator }
  | { type: 'left-paren' }
  | { type: 'right-paren' }
  | { type: 'equals' };

export type MathExpressionNode =
  | { type: 'number'; value: number }
  | { type: 'unary'; operator: '+' | '-'; operand: MathExpressionNode }
  | { type: 'binary'; operator: MathOperator; left: MathExpressionNode; right: MathExpressionNode };

export type Evaluation =
  | { ok: true; value: number; display: string }
  | { ok: false; display: 'Undefined' | 'Invalid expression' };

export function tokenize(source: string): MathToken[] {
  if (typeof source !== 'string') throw new Error('Invalid expression');

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
      tokens.push({ type: 'operator', value: value as MathOperator });
      index += 1;
      continue;
    }

    if (char === '(') {
      tokens.push({ type: 'left-paren' });
      index += 1;
      continue;
    }

    if (char === ')') {
      tokens.push({ type: 'right-paren' });
      index += 1;
      continue;
    }

    if (char === '=') {
      tokens.push({ type: 'equals' });
      index += 1;
      continue;
    }

    throw new Error('Unsupported character');
  }

  return tokens;
}

class DivisionByZeroError extends Error {}

class Parser {
  private cursor = 0;

  constructor(private readonly tokens: MathToken[]) {}

  parse(): MathExpressionNode {
    const node = this.parseExpression();
    if (this.peek()?.type === 'equals') {
      this.cursor += 1;
    }
    if (this.cursor !== this.tokens.length) {
      throw new Error('Unexpected token');
    }
    return node;
  }

  private parseExpression(): MathExpressionNode {
    let node = this.parseTerm();

    while (this.peekOperator('+', '-')) {
      const operator = this.consumeOperator();
      const right = this.parseTerm();
      node = { type: 'binary', operator, left: node, right };
    }

    return node;
  }

  private parseTerm(): MathExpressionNode {
    let node = this.parseUnary();

    while (this.peekOperator('×', '÷')) {
      const operator = this.consumeOperator();
      const right = this.parseUnary();
      node = { type: 'binary', operator, left: node, right };
    }

    return node;
  }

  private parseUnary(): MathExpressionNode {
    const token = this.peek();

    if (token?.type === 'operator' && (token.value === '+' || token.value === '-')) {
      const operator = this.consumeOperator();
      const normalized = operator === '+' || operator === '-' ? operator : '+';
      const operand = this.parseUnary();
      return { type: 'unary', operator: normalized, operand };
    }

    if (token?.type === 'left-paren') {
      this.cursor += 1;
      const inner = this.parseExpression();
      if (this.peek()?.type !== 'right-paren') {
        throw new Error('Missing closing parenthesis');
      }
      this.cursor += 1;
      return inner;
    }

    if (token?.type === 'number') {
      this.cursor += 1;
      return { type: 'number', value: token.value };
    }

    throw new Error('Expected number');
  }

  private peek(): MathToken | undefined {
    return this.tokens[this.cursor];
  }

  private peekOperator(...operators: MathOperator[]): MathOperator | undefined {
    const token = this.peek();
    if (token?.type !== 'operator') return undefined;
    return operators.includes(token.value) ? token.value : undefined;
  }

  private consumeOperator(): MathOperator {
    const token = this.peek();
    if (token?.type !== 'operator') {
      throw new Error('Expected operator');
    }

    this.cursor += 1;
    return token.value;
  }
}

export function parseExpression(source: string | MathToken[]): MathExpressionNode {
  const tokens = typeof source === 'string' ? tokenize(source) : source;
  return new Parser(tokens).parse();
}

export function evaluateAst(node: MathExpressionNode): number {
  if (node.type === 'number') {
    return node.value;
  }

  if (node.type === 'unary') {
    const operand = evaluateAst(node.operand);
    return node.operator === '-' ? -operand : operand;
  }

  const left = evaluateAst(node.left);
  const right = evaluateAst(node.right);

  if (node.operator === '+') return left + right;
  if (node.operator === '-') return left - right;
  if (node.operator === '×') return left * right;
  if (node.operator === '÷') {
    if (right === 0 || Object.is(right, -0)) {
      throw new DivisionByZeroError();
    }
    return left / right;
  }

  throw new Error('Unsupported operator');
}

function formatNumber(value: number): string {
  const normalized = Number(value.toFixed(3));
  const text = Object.is(normalized, -0) ? '0' : String(normalized);
  return text.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

export function evaluateExpression(source: string): Evaluation {
  try {
    const tokens = tokenize(source);
    if (tokens.length === 0) {
      return { ok: false, display: 'Invalid expression' };
    }

    const equals = tokens.filter((token) => token.type === 'equals');
    if (equals.length > 1 || (equals.length === 1 && tokens[tokens.length - 1]?.type !== 'equals')) {
      return { ok: false, display: 'Invalid expression' };
    }

    const ast = parseExpression(tokens);
    const value = evaluateAst(ast);

    if (!Number.isFinite(value)) {
      return { ok: false, display: 'Invalid expression' };
    }

    return { ok: true, value, display: formatNumber(value) };
  } catch (error) {
    if (error instanceof DivisionByZeroError) {
      return { ok: false, display: 'Undefined' };
    }
    return { ok: false, display: 'Invalid expression' };
  }
}
