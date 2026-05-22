import { describe, expect, it } from 'vitest';
import type { MotionDataset } from '../types/dataset';
import {
  buildLogLambdaGrid,
  fitLassoAnalysis,
  fitLassoAnalysisWithTarget,
  fitLassoRegression,
  formatLassoCoefficient,
} from './lasso';

const constantAccelerationDataset: MotionDataset = {
  id: 'constant',
  name: '상수 가속도',
  rows: [
    { t: 0, x: 0, v: 0, a: 9.8 },
    { t: 1, x: 1, v: 1, a: 9.8 },
    { t: 2, x: 2, v: 2, a: 9.8 },
    { t: 3, x: 3, v: 3, a: 9.8 },
    { t: 4, x: 4, v: 4, a: 9.8 },
  ],
};

describe('lasso regression utilities', () => {
  it('fits the constant acceleration in browser-safe TypeScript code', () => {
    const result = fitLassoRegression(['1', 'x', 'v'], constantAccelerationDataset, {
      lambda: 0.12,
      standardize: true,
    });

    expect(result.coefficients[0].coefficient).toBeCloseTo(9.8);
    expect(result.rSquared).toBe(1);
    expect(result.mae).toBeCloseTo(0);
  });

  it('returns coefficients on the original feature scale after standardization', () => {
    const dataset: MotionDataset = {
      id: 'linear',
      name: '선형 테스트',
      rows: [
        { t: 0, x: 0, v: 0, a: 2 },
        { t: 1, x: 1, v: 0, a: 5 },
        { t: 2, x: 2, v: 0, a: 8 },
        { t: 3, x: 3, v: 0, a: 11 },
      ],
    };

    const result = fitLassoRegression(['1', 'x'], dataset, {
      lambda: 0,
      standardize: true,
    });

    expect(result.coefficients[0].coefficient).toBeCloseTo(2);
    expect(result.coefficients[1].coefficient).toBeCloseTo(3);
    expect(result.mae).toBeCloseTo(0);
  });

  it('marks small coefficients as removed', () => {
    const result = fitLassoRegression(['1', 'x', 'v'], constantAccelerationDataset, {
      lambda: 10,
      standardize: true,
    });

    expect(result.coefficients.some((coefficient) => coefficient.status === '제거됨')).toBe(
      true,
    );
    expect(formatLassoCoefficient(1e-9)).toBe('0');
  });

  it('throws Korean errors for invalid fitting input', () => {
    expect(() =>
      fitLassoRegression([], constantAccelerationDataset, { lambda: 0.1, standardize: true }),
    ).toThrow('피팅할 후보 항을 하나 이상 입력하세요.');

    expect(() =>
      fitLassoRegression(['a'], constantAccelerationDataset, {
        lambda: 0.1,
        standardize: true,
      }),
    ).toThrow('가속도 a는 목표값이므로 후보 항에 사용할 수 없습니다.');
  });

  it('builds a logarithmic lambda grid for automatic search', () => {
    const grid = buildLogLambdaGrid(0.001, 10, 5);

    expect(grid).toHaveLength(5);
    expect(grid[0]).toBeCloseTo(0.001);
    expect(grid[4]).toBeCloseTo(10);
  });

  it('selects the best lambda with 5-fold cross-validation', () => {
    const result = fitLassoAnalysis(['1', 'x', 'v'], constantAccelerationDataset, {
      lambda: 0.12,
      standardize: true,
      autoSearch: true,
      validationMode: '5-fold 교차검증',
      lambdaGrid: [0.001, 0.01, 0.1],
      maxIterations: 1000,
    });

    expect(result.validationCurve).toHaveLength(3);
    expect(result.optimalLambda).toBeGreaterThanOrEqual(0.001);
    expect(result.validationMse).toBeGreaterThanOrEqual(0);
    expect(result.validationMode).toBe('5-fold 교차검증');
  });

  it('fits Lasso against a custom neural prediction target', () => {
    const neuralTarget = constantAccelerationDataset.rows.map(() => 9.8);
    const result = fitLassoAnalysisWithTarget(['1', 'x', 'v'], constantAccelerationDataset, neuralTarget, {
      lambda: 0.01,
      standardize: true,
      autoSearch: false,
      validationMode: '전체 데이터 사용',
    });

    expect(result.coefficients[0].coefficient).toBeCloseTo(9.8);
    expect(result.mae).toBeCloseTo(0);
  });
});
