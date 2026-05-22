import { describe, expect, it } from 'vitest';
import type { MotionDataset } from '../types/dataset';
import { buildFeatureMatrix, evaluateTerm, parseTerm } from './formula';

const row = {
  t: 0.5,
  x: 2,
  v: -3,
  a: 9.8,
};

describe('formula utilities', () => {
  it('supports the allowed example terms', () => {
    ['1', 'x', 'v', 'v^2', 'x*v', 'abs(v)*v', 'sin(x)', 'sign(v)'].forEach((term) => {
      expect(() => parseTerm(term)).not.toThrow();
    });
  });

  it('evaluates supported expressions with dataset row variables', () => {
    expect(evaluateTerm('1', row)).toBe(1);
    expect(evaluateTerm('x*v', row)).toBe(-6);
    expect(evaluateTerm('v^2', row)).toBe(9);
    expect(evaluateTerm('abs(v)*v', row)).toBe(-9);
    expect(evaluateTerm('sin(x)', row)).toBeCloseTo(Math.sin(2));
    expect(evaluateTerm('sign(v)', row)).toBe(-1);
    expect(evaluateTerm('sign(t - 0.25)', row)).toBe(1);
    expect(evaluateTerm('sqrt(x)', row)).toBeCloseTo(Math.sqrt(2));
  });

  it('evaluates sign values for negative, zero, and positive inputs', () => {
    expect(evaluateTerm('sign(v)', { ...row, v: 4 })).toBe(1);
    expect(evaluateTerm('sign(v)', { ...row, v: -2 })).toBe(-1);
    expect(evaluateTerm('sign(v)', { ...row, v: 0 })).toBe(0);
  });

  it('builds a feature matrix for all rows and terms', () => {
    const dataset: MotionDataset = {
      id: 'test',
      name: '테스트',
      rows: [
        { t: 0, x: 0, v: 0, a: 9.8 },
        { t: 1, x: 4.9, v: 9.8, a: 9.8 },
      ],
    };

    expect(buildFeatureMatrix(['1', 'x', 'v^2'], dataset)).toEqual([
      [1, 0, 0],
      [1, 4.9, 96.04000000000002],
    ]);
  });

  it('rejects unsupported variables, functions, and implicit multiplication', () => {
    expect(() => parseTerm('y')).toThrow('지원하지 않는 변수입니다: y');
    expect(() => parseTerm('a')).toThrow(
      '가속도 a는 목표값이므로 후보 항에 사용할 수 없습니다.',
    );
    expect(() => parseTerm('x*a')).toThrow(
      '가속도 a는 목표값이므로 후보 항에 사용할 수 없습니다.',
    );
    expect(() => parseTerm('sign(a)')).toThrow(
      '가속도 a는 목표값이므로 후보 항에 사용할 수 없습니다.',
    );
    expect(() => parseTerm('tan(x)')).toThrow('지원하지 않는 함수입니다: tan');
    expect(() => parseTerm('2x')).toThrow('곱셈은 * 기호로 입력하세요.');
    expect(() => parseTerm('x+')).toThrow('수식 문법이 올바르지 않습니다.');
  });

  it('does not crash when an expression evaluates to an invalid number', () => {
    expect(() => evaluateTerm('sqrt(-1)', row)).toThrow('계산 결과가 유효하지 않습니다.');
  });
});
