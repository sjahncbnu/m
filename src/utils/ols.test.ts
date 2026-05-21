import { describe, expect, it } from 'vitest';
import { demoDataset } from '../data/demoDataset';
import type { MotionDataset } from '../types/dataset';
import { fitOrdinaryLeastSquares, hasAccelerationValues } from './ols';

describe('ordinary least squares utilities', () => {
  it('fits a constant net force from the demo acceleration data', () => {
    const result = fitOrdinaryLeastSquares(['1'], demoDataset, 1);

    expect(result.coefficients).toHaveLength(1);
    expect(result.coefficients[0]).toBeCloseTo(9.8);
    expect(result.rSquared).toBe(1);
    expect(result.mae).toBeCloseTo(0);
  });

  it('fits multiple independent terms', () => {
    const result = fitOrdinaryLeastSquares(['1', 't'], demoDataset, 1);

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
    expect(() => fitOrdinaryLeastSquares(['1'], dataset, 1)).toThrow(
      '가속도 a 값이 없어 목표값을 만들 수 없습니다.',
    );
  });

  it('shows a friendly error for singular matrices', () => {
    expect(() => fitOrdinaryLeastSquares(['x', 'v^2'], demoDataset, 1)).toThrow(
      '행렬이 특이하여 계수를 추정할 수 없습니다.',
    );
  });
});
