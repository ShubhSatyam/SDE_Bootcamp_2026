import { evaluateExpression } from '../math/evaluate';

export function normalizeMathText(text: string): string {
  return text
    .replace(/\$\$?/g, '')
    .replace(/\\(?:left|right)\b/g, '')
    .replace(/\\(?:times|cdot)\b/g, '×')
    .replace(/\\div\b/g, '÷')
    .replace(/\\(?:minus)\b/g, '-')
    .replace(/\\(?:,|;|!|quad|qquad)/g, '')
    .replace(/[{}]/g, '')
    .replace(/[−–]/g, '-')
    .replace(/[×·]/g, '×')
    .replace(/[÷]/g, '÷')
    .replace(/\*/g, '×')
    .replace(/\//g, '÷')
    .replace(/\s+/g, '');
}

export function isSupportedMathExpression(expression: string): boolean {
  return expression.length > 0 && /^[0-9+\-×÷.=]+$/.test(expression);
}

export function interpretRecognition(text: string): { expression: string; result: string } {
  const expression = normalizeMathText(text);
  return { expression, result: evaluateExpression(expression).display };
}
