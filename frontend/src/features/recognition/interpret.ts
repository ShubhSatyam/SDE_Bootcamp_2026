import { evaluateExpression } from '../calculator/evaluate';

export function normalizeMathText(text: string): string {
  return text
    .replace(/\$\$?/g, '')
    .replace(/\\(?:left|right)(?![A-Za-z])/g, '')
    .replace(/\\(?:times|cdot)(?![A-Za-z])/g, '×')
    .replace(/\\div(?![A-Za-z])/g, '÷')
    .replace(/\\minus(?![A-Za-z])/g, '-')
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
  if (typeof expression !== 'string' || expression.length === 0) {
    return false;
  }

  if (!/^[0-9+\-×÷().=]+$/.test(expression)) {
    return false;
  }

  return evaluateExpression(expression).ok;
}

export function interpretRecognition(text: string): { expression: string; result: string } {
  const expression = normalizeMathText(text);
  return { expression, result: evaluateExpression(expression).display };
}

export function formatCalculationAnswer(expression: string, result: string): string {
  const separator = expression.endsWith('=') ? ' ' : ' = ';
  return `${expression}${separator}${result}`;
}
