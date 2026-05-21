import { parse, type MathNode } from 'mathjs/number';
import type { DatasetRow, MotionDataset } from '../types/dataset';

const allowedVariables = new Set(['t', 'x', 'v', 'a']);
const allowedOperators = new Set(['+', '-', '*', '/', '^']);
const allowedFunctions = {
  abs: Math.abs,
  sin: Math.sin,
  cos: Math.cos,
  exp: Math.exp,
  log: Math.log,
  sqrt: Math.sqrt,
} satisfies Record<string, (value: number) => number>;

type SupportedFunction = keyof typeof allowedFunctions;

export type ParsedTerm = {
  expression: string;
  node: MathNode;
};

export class FormulaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormulaError';
  }
}

function getNodeName(node: MathNode) {
  return (node as unknown as { name?: string }).name;
}

function getNodeValue(node: MathNode) {
  return (node as unknown as { value?: string | number }).value;
}

function getNodeArgs(node: MathNode) {
  return (node as unknown as { args?: MathNode[] }).args ?? [];
}

function getNodeContent(node: MathNode) {
  return (node as unknown as { content?: MathNode }).content;
}

function getNodeOperator(node: MathNode) {
  return (node as unknown as { op?: string }).op;
}

function getNodeFunction(node: MathNode) {
  return (node as unknown as { fn?: string }).fn;
}

function isImplicitOperator(node: MathNode) {
  return Boolean((node as unknown as { implicit?: boolean }).implicit);
}

function isSupportedFunction(name: string): name is SupportedFunction {
  return name in allowedFunctions;
}

function validateNode(node: MathNode) {
  switch (node.type) {
    case 'ConstantNode': {
      const value = Number(getNodeValue(node));

      if (!Number.isFinite(value)) {
        throw new FormulaError('숫자 상수만 사용할 수 있습니다.');
      }

      return;
    }

    case 'SymbolNode': {
      const name = getNodeName(node);

      if (!name || !allowedVariables.has(name)) {
        throw new FormulaError(`지원하지 않는 변수입니다: ${name ?? '알 수 없음'}`);
      }

      return;
    }

    case 'ParenthesisNode': {
      const content = getNodeContent(node);

      if (!content) {
        throw new FormulaError('빈 괄호는 사용할 수 없습니다.');
      }

      validateNode(content);
      return;
    }

    case 'OperatorNode': {
      const operator = getNodeOperator(node);

      if (!operator || !allowedOperators.has(operator)) {
        throw new FormulaError(`지원하지 않는 연산자입니다: ${operator ?? '알 수 없음'}`);
      }

      if (isImplicitOperator(node)) {
        throw new FormulaError('곱셈은 * 기호로 입력하세요.');
      }

      getNodeArgs(node).forEach(validateNode);
      return;
    }

    case 'FunctionNode': {
      const name = getNodeName(node);
      const args = getNodeArgs(node);

      if (!name || !isSupportedFunction(name)) {
        throw new FormulaError(`지원하지 않는 함수입니다: ${name ?? '알 수 없음'}`);
      }

      if (args.length !== 1) {
        throw new FormulaError(`${name} 함수는 인자 1개만 사용할 수 있습니다.`);
      }

      args.forEach(validateNode);
      return;
    }

    default:
      throw new FormulaError('지원하지 않는 수식 형식입니다.');
  }
}

function evaluateNode(node: MathNode, row: DatasetRow): number {
  switch (node.type) {
    case 'ConstantNode':
      return Number(getNodeValue(node));

    case 'SymbolNode': {
      const name = getNodeName(node) as keyof DatasetRow;
      return row[name];
    }

    case 'ParenthesisNode': {
      const content = getNodeContent(node);

      if (!content) {
        throw new FormulaError('빈 괄호는 계산할 수 없습니다.');
      }

      return evaluateNode(content, row);
    }

    case 'OperatorNode': {
      const args = getNodeArgs(node);
      const operator = getNodeOperator(node);
      const fn = getNodeFunction(node);

      if (fn === 'unaryMinus') {
        return -evaluateNode(args[0], row);
      }

      if (fn === 'unaryPlus') {
        return evaluateNode(args[0], row);
      }

      const left = evaluateNode(args[0], row);
      const right = evaluateNode(args[1], row);

      switch (operator) {
        case '+':
          return left + right;
        case '-':
          return left - right;
        case '*':
          return left * right;
        case '/':
          return left / right;
        case '^':
          return left ** right;
        default:
          throw new FormulaError('지원하지 않는 연산자입니다.');
      }
    }

    case 'FunctionNode': {
      const name = getNodeName(node);
      const args = getNodeArgs(node);

      if (!name || !isSupportedFunction(name)) {
        throw new FormulaError('지원하지 않는 함수입니다.');
      }

      return allowedFunctions[name](evaluateNode(args[0], row));
    }

    default:
      throw new FormulaError('지원하지 않는 수식 형식입니다.');
  }
}

export function parseTerm(expression: string): ParsedTerm {
  const trimmedExpression = expression.trim();

  if (!trimmedExpression) {
    throw new FormulaError('항을 입력하세요.');
  }

  try {
    const node = parse(trimmedExpression);
    validateNode(node);

    return {
      expression: trimmedExpression,
      node,
    };
  } catch (error) {
    if (error instanceof FormulaError) {
      throw error;
    }

    throw new FormulaError('수식 문법이 올바르지 않습니다.');
  }
}

export function evaluateTerm(expression: string, row: DatasetRow): number {
  const parsedTerm = parseTerm(expression);
  const value = evaluateNode(parsedTerm.node, row);

  if (!Number.isFinite(value)) {
    throw new FormulaError('계산 결과가 유효하지 않습니다.');
  }

  return value;
}

export function buildFeatureMatrix(terms: string[], dataset: MotionDataset): number[][] {
  const parsedTerms = terms.map(parseTerm);

  return dataset.rows.map((row) =>
    parsedTerms.map((term) => {
      const value = evaluateNode(term.node, row);

      if (!Number.isFinite(value)) {
        throw new FormulaError(`"${term.expression}" 항의 계산 결과가 유효하지 않습니다.`);
      }

      return value;
    }),
  );
}
