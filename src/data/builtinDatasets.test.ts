import { describe, expect, it, vi } from 'vitest';
import { builtInDatasets } from './builtinDatasets';
import {
  buildProcessedDataset,
  defaultDerivativeSettings,
  type DerivativeSettings,
} from '../utils/derivatives';

const expectedDatasetNames = [
  '자유낙하 운동 - 이상 데이터',
  '자유낙하 운동 - 약한 노이즈',
  '등속 운동',
  '등가속도 운동',
  '용수철 운동',
  '약한 노이즈 등가속도 운동',
  '중간 노이즈 자유낙하 운동',
  '감쇠 용수철 운동',
  '비선형 용수철 운동',
  '감쇠 비선형 용수철 운동',
  '공기저항이 있는 낙하 운동',
  '외력이 있는 감쇠 진동',
  '큰 각도 단진자 운동',
  '마찰이 있는 미끄럼 운동',
  '구간별 힘 변화 운동',
];

const smoothingSettings: DerivativeSettings = {
  method: 'Savitzky-Golay 필터 + 미분',
  windowLength: 101,
  polynomialOrder: 3,
};

function centerRows(datasetId: string) {
  const rawDataset = builtInDatasets.find((dataset) => dataset.id === datasetId);

  if (!rawDataset) {
    throw new Error(`테스트 데이터셋을 찾을 수 없습니다: ${datasetId}`);
  }

  const processedDataset = buildProcessedDataset(rawDataset, defaultDerivativeSettings);
  const start = Math.floor(processedDataset.rows.length * 0.1);
  const end = Math.floor(processedDataset.rows.length * 0.9);

  return processedDataset.rows.slice(start, end);
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function processedRows(datasetId: string, settings: DerivativeSettings = smoothingSettings) {
  const rawDataset = builtInDatasets.find((dataset) => dataset.id === datasetId);

  if (!rawDataset) {
    throw new Error(`테스트 데이터셋을 찾을 수 없습니다: ${datasetId}`);
  }

  return buildProcessedDataset(rawDataset, settings).rows;
}

function meanAbsoluteError(values: number[], expectedValues: number[]) {
  return mean(values.map((value, index) => Math.abs(value - expectedValues[index])));
}

describe('built-in raw datasets', () => {
  it('provides the required deterministic 1000-row raw datasets', () => {
    expect(builtInDatasets.map((dataset) => dataset.name)).toEqual(expectedDatasetNames);

    builtInDatasets.forEach((dataset) => {
      expect(dataset.rawRows).toHaveLength(1000);
      expect(dataset.rawColumns).toEqual(['t', 'x']);
      expect(dataset.units).toEqual({ t: 's', x: 'm' });
      expect(Object.keys(dataset.rawRows[0]).sort()).toEqual(['t', 'x']);
      expect('v' in dataset.rawRows[0]).toBe(false);
      expect('a' in dataset.rawRows[0]).toBe(false);
    });
  });

  it('keeps deterministic noisy rows stable for representative datasets', async () => {
    vi.resetModules();
    const freshModule = await import('./builtinDatasets');
    const noisyConstant = builtInDatasets.find(
      (dataset) => dataset.id === 'weak-noise-constant-acceleration',
    );
    const freshNoisyConstant = freshModule.builtInDatasets.find(
      (dataset) => dataset.id === 'weak-noise-constant-acceleration',
    );
    const dampedSpring = builtInDatasets.find((dataset) => dataset.id === 'damped-spring');
    const freshDampedSpring = freshModule.builtInDatasets.find(
      (dataset) => dataset.id === 'damped-spring',
    );

    expect(freshNoisyConstant?.rawRows[0]).toEqual(noisyConstant?.rawRows[0]);
    expect(freshNoisyConstant?.rawRows[500]).toEqual(noisyConstant?.rawRows[500]);
    expect(freshDampedSpring?.rawRows[500]).toEqual(dampedSpring?.rawRows[500]);
  });

  it('derives expected acceleration behavior from representative datasets', () => {
    expect(mean(centerRows('free-fall-ideal').map((row) => row.a))).toBeCloseTo(9.8, 1);
    expect(mean(centerRows('uniform-motion').map((row) => row.a))).toBeCloseTo(0, 1);
    expect(mean(centerRows('constant-acceleration').map((row) => row.a))).toBeCloseTo(2, 1);

    const springRows = centerRows('spring-motion');
    const relationError = mean(springRows.map((row) => Math.abs(row.a + 4 * row.x)));

    expect(relationError).toBeLessThan(0.05);
  });

  it('removes derivative boundary artifacts from processed fitting rows', () => {
    const rawDataset = builtInDatasets.find((dataset) => dataset.id === 'free-fall-ideal');

    if (!rawDataset) {
      throw new Error('이상 자유낙하 데이터셋을 찾을 수 없습니다.');
    }

    const processedDataset = buildProcessedDataset(rawDataset, defaultDerivativeSettings);
    const accelerations = processedDataset.rows.map((row) => row.a);

    expect(processedDataset.rows.length).toBe(rawDataset.rawRows.length - 4);
    expect(Math.min(...accelerations)).toBeGreaterThan(9.7);
    expect(Math.max(...accelerations)).toBeLessThan(9.9);
  });

  it('stabilizes weak-noise free fall acceleration with Savitzky-Golay differentiation', () => {
    const rawDataset = builtInDatasets.find((dataset) => dataset.id === 'free-fall-noisy');

    if (!rawDataset) {
      throw new Error('약한 노이즈 자유낙하 데이터셋을 찾을 수 없습니다.');
    }

    const processedDataset = buildProcessedDataset(rawDataset, {
      method: 'Savitzky-Golay 필터 + 미분',
      windowLength: 101,
      polynomialOrder: 2,
    });
    const centerAcceleration = processedDataset.rows
      .slice(100, 900)
      .map((row) => row.a);
    const largestDeviation = Math.max(
      ...centerAcceleration.map((acceleration) => Math.abs(acceleration - 9.8)),
    );

    expect(mean(centerAcceleration)).toBeCloseTo(9.8, 0);
    expect(largestDeviation).toBeLessThan(3);
  });

  it('derives expected behavior from new noisy physics datasets after smoothing', () => {
    const weakConstantRows = processedRows('weak-noise-constant-acceleration');
    const mediumFreeFallRows = processedRows('medium-noise-free-fall');
    const dampedSpringRows = processedRows('damped-spring');
    const nonlinearRows = processedRows('nonlinear-spring');
    const airRows = processedRows('air-resistance-fall');
    const pendulumRows = processedRows('large-angle-pendulum');

    expect(mean(weakConstantRows.map((row) => row.a))).toBeCloseTo(2, 0);
    expect(mean(mediumFreeFallRows.map((row) => row.a))).toBeCloseTo(9.8, 0);

    expect(
      meanAbsoluteError(
        dampedSpringRows.map((row) => row.a),
        dampedSpringRows.map((row) => -4 * row.x - 0.45 * row.v),
      ),
    ).toBeLessThan(2);
    expect(
      meanAbsoluteError(
        nonlinearRows.map((row) => row.a),
        nonlinearRows.map((row) => -3 * row.x - 1.2 * row.x ** 3),
      ),
    ).toBeLessThan(2.5);
    expect(airRows.every((row) => Number.isFinite(row.a) && Number.isFinite(row.v))).toBe(true);
    expect(
      meanAbsoluteError(
        pendulumRows.map((row) => row.a),
        pendulumRows.map((row) => -9.8 * Math.sin(row.x)),
      ),
    ).toBeLessThan(3);
  });
});
