/**
 * Safe Mathematical Expression Parser and Evaluator
 * Implemented using a Recursive Descent Parser without using native JavaScript evaluation functions.
 * Supports:
 * - Basic arithmetic (+, -, *, /, ×, ÷)
 * - Operator precedence (PEMDAS)
 * - Parentheses (nested expressions)
 * - Unary negation (e.g. -5, 4 * -3, -(2 + 3))
 * - Floating point numbers (e.g. 3.14)
 * - Division by zero detection
 * - Precision formatting for floating point results
 */

export type TokenType = 'NUMBER' | 'OP' | 'LPAREN' | 'RPAREN';

export interface Token {
  type: TokenType;
  value: string;
}

/**
 * Tokenize an arithmetic expression string
 */
export function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = expr.trim();

  while (i < s.length) {
    const char = s[i];

    // Skip whitespace
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Number (including decimals, e.g., 42 or 3.14 or .5)
    if (/\d/.test(char) || (char === '.' && i + 1 < s.length && /\d/.test(s[i + 1]))) {
      let numStr = '';
      let hasDot = false;
      while (i < s.length && (/\d/.test(s[i]) || s[i] === '.')) {
        if (s[i] === '.') {
          if (hasDot) {
            throw new Error(`Invalid number format: unexpected multiple decimal points`);
          }
          hasDot = true;
        }
        numStr += s[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: numStr });
      continue;
    }

    // Parentheses
    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }
    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }

    // Operators: +, -, *, /, ×, ÷
    if (['+', '-', '*', '/', '×', '÷'].includes(char)) {
      let normalized = char;
      if (char === '×') normalized = '*';
      if (char === '÷') normalized = '/';
      tokens.push({ type: 'OP', value: normalized });
      i++;
      continue;
    }

    throw new Error(`Unexpected character: "${char}"`);
  }

  return tokens;
}

/**
 * Formats a numeric result cleanly to eliminate IEEE 754 floating-point inaccuracies
 * e.g., 0.1 + 0.2 -> "0.3" instead of "0.30000000000000004"
 */
export function formatResult(value: number): string {
  if (!isFinite(value)) {
    throw new Error('Result is undefined or infinite');
  }
  // Trim float jitter with precision 12
  const fixedPrecision = parseFloat(value.toPrecision(12));
  if (Object.is(fixedPrecision, -0)) {
    return '0';
  }
  return String(fixedPrecision);
}

/**
 * Recursive Descent Expression Parser
 */
class ExpressionParser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    const token = this.tokens[this.pos];
    this.pos++;
    return token;
  }

  public parse(): number {
    if (this.tokens.length === 0) {
      throw new Error('Empty expression');
    }
    const result = this.parseExpression();
    if (this.pos < this.tokens.length) {
      const leftover = this.tokens[this.pos];
      throw new Error(`Unexpected token at end: "${leftover.value}"`);
    }
    return result;
  }

  // expression -> additive
  private parseExpression(): number {
    return this.parseAdditive();
  }

  // additive -> multiplicative (('+' | '-') multiplicative)*
  private parseAdditive(): number {
    let left = this.parseMultiplicative();

    while (this.pos < this.tokens.length) {
      const token = this.peek();
      if (token && token.type === 'OP' && (token.value === '+' || token.value === '-')) {
        this.consume();
        const right = this.parseMultiplicative();
        if (token.value === '+') {
          left = left + right;
        } else {
          left = left - right;
        }
      } else {
        break;
      }
    }

    return left;
  }

  // multiplicative -> unary (('*' | '/') unary)*
  private parseMultiplicative(): number {
    let left = this.parseUnary();

    while (this.pos < this.tokens.length) {
      const token = this.peek();
      if (token && token.type === 'OP' && (token.value === '*' || token.value === '/')) {
        this.consume();
        const right = this.parseUnary();
        if (token.value === '*') {
          left = left * right;
        } else {
          if (right === 0) {
            throw new Error('Cannot divide by 0');
          }
          left = left / right;
        }
      } else {
        break;
      }
    }

    return left;
  }

  // unary -> ('+' | '-') unary | primary
  private parseUnary(): number {
    const token = this.peek();
    if (token && token.type === 'OP' && (token.value === '+' || token.value === '-')) {
      this.consume();
      const val = this.parseUnary();
      return token.value === '-' ? -val : val;
    }
    return this.parsePrimary();
  }

  // primary -> NUMBER | '(' expression ')'
  private parsePrimary(): number {
    const token = this.peek();
    if (!token) {
      throw new Error('Unexpected end of expression');
    }

    if (token.type === 'NUMBER') {
      this.consume();
      const val = parseFloat(token.value);
      if (isNaN(val)) {
        throw new Error(`Invalid number: "${token.value}"`);
      }
      return val;
    }

    if (token.type === 'LPAREN') {
      this.consume(); // consume '('
      const val = this.parseExpression();
      const closing = this.peek();
      if (!closing || closing.type !== 'RPAREN') {
        throw new Error('Mismatched parentheses: missing ")"');
      }
      this.consume(); // consume ')'
      return val;
    }

    throw new Error(`Unexpected token: "${token.value}"`);
  }
}

/**
 * Evaluates an arithmetic expression string and returns the formatted result
 * Throws an Error if syntax is invalid or calculation error (e.g. division by zero)
 */
export function evaluateExpression(expr: string): string {
  if (!expr || expr.trim() === '') {
    throw new Error('Expression is empty');
  }
  const tokens = tokenize(expr);
  const parser = new ExpressionParser(tokens);
  const rawResult = parser.parse();
  return formatResult(rawResult);
}
