import { describe, expect, it } from 'vitest';
import type { MotionDataset } from '../types/dataset';
import { fitOrdinaryLeastSquares, hasAccelerationValues } from './ols';

const constantAccelerationDataset: MotionDataset = {
  id: 'constant',
  name: '상수 가속도',
  rows: [
    { t: 0, x: 0, v: 0, a: 9.8 },
    { t: 1, x: 1, v: 1, a: 9.8 },
    { t: 2, x: 2, v: 2, a: 9.8 },
    { t: 3, x: 3, v: 3, a: 9.8 },
  ],
};

describe('ordinary least squares utilities', () => {
  it('fits a constant acceleration from the demo data', () => {
    const result = fitOrdinaryLeastSquares(['1'], constantAccelerationDataset);

    expect(result.coefficients).toHaveLength(1);
    expect(result.coefficients[0]).toBeCloseTo(9.8);
    expect(result.rSquared).toBe(1);
    expect(result.mae).toBeCloseTo(0);
  });

  it('fits multiple independent terms', () => {
    const result = fitOrdinaryLeastSquares(['1', 't'], constantAccelerationDataset);

    expect(result.coefficients[0]).toBeCloseTo(9.8);
    expect(result.coefficients[1]).toBeCloseTo(0);
    expect(result.mae).toBeCloseTo(0);
  });

  it('detects missing acceleration values', () => {
    const dataset = {
      id: 'missing-a',
      name: '가속도 없음',
      rows: [{ t: 0, x: 0, v: 0 }],
    } as unknown as MotionDataset;

    expect(hasAccelerationValues(dataset)).toBe(false);
    expect(() => fitOrdinaryLeastSquares(['1'], dataset)).toThrow(
      '가속도 a 값이 없어 목표값을 만들 수 없습니다.',
    );
  });

  it('shows a friendly error for singular matrices', () => {
    const singularDataset: MotionDataset = {
      id: 'singular',
      name: '특이 행렬',
      rows: [
        { t: 0, x: 0, v: 0, a: 1 },
        { t: 1, x: 1, v: 1, a: 1 },
        { t: 2, x: 4, v: 2, a: 1 },
        { t: 3, x: 9, v: 3, a: 1 },
      ],
    };

    expect(() => fitOrdinaryLeastSquares(['x', 'v^2'], singularDataset)).toThrow(
      '행렬이 특이하여 계수를 추정할 수 없습니다.',
    );
  });
});
