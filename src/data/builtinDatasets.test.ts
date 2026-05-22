import { describe, expect, it, vi } from 'vitest';
import { builtInDatasets } from './builtinDatasets';
import {
  buildProcessedDataset,
  type DerivativeSettings,
} from '../utils/derivatives';

const expectedDatasetNames = [
  '등가속도 운동',
  '낙하 + 선형저항',
  '단순 용수철',
  '매달린 용수철',
  '점성감쇠 진동',
  '낙하 + 이차저항',
  '강제 진동',
  '용수철 + 쿨롱 마찰',
  '비대칭 용수철',
  'Duffing 진동자',
  '점성 + 쿨롱 감쇠',
  'Van der Pol 진동자',
  '이차저항 진동',
  '비대칭 + 점성감쇠 용수철',
  'Duffing + 점성감쇠',
  'Duffing + 강제진동',
  'Duffing + 점성감쇠 + 강제진동',
  '비대칭 + 점성 + 쿨롱',
  '비대칭 + 이차저항',
  '점성 + 이차저항 진동',
  '점성 + 쿨롱 + 이차저항',
  '비대칭 Duffing형 감쇠 진동',
  '거의 다 넣은 일반 모델',
];

const smoothingSettings: DerivativeSettings = {
  method: 'Savitzky-Golay 필터 + 미분',
  windowLength: 101,
  polynomialOrder: 3,
};

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

describe('built-in raw physics datasets', () => {
  it('provides the requested deterministic 1000-row raw datasets', () => {
    expect(builtInDatasets.map((dataset) => dataset.name)).toEqual(expectedDatasetNames);

    builtInDatasets.forEach((dataset, index) => {
      expect(dataset.difficulty).toBe(index + 1);
      expect(dataset.rawRows).toHaveLength(1000);
      expect(dataset.rawColumns).toEqual(['t', 'x']);
      expect(dataset.units).toEqual({ t: 's', x: 'm' });
      expect(Object.keys(dataset.rawRows[0]).sort()).toEqual(['t', 'x']);
      expect('v' in dataset.rawRows[0]).toBe(false);
      expect('a' in dataset.rawRows[0]).toBe(false);
    });
  });

  it('keeps generated rows deterministic', async () => {
    vi.resetModules();
    const freshModule = await import('./builtinDatasets');

    builtInDatasets.forEach((dataset) => {
      const freshDataset = freshModule.builtInDatasets.find((item) => item.id === dataset.id);

      expect(freshDataset?.rawRows[0]).toEqual(dataset.rawRows[0]);
      expect(freshDataset?.rawRows[500]).toEqual(dataset.rawRows[500]);
      expect(freshDataset?.rawRows[999]).toEqual(dataset.rawRows[999]);
    });
  });

  it('derives expected acceleration behavior from representative models after smoothing', () => {
    const constantRows = processedRows('constant-force-motion');
    const simpleSpringRows = processedRows('simple-spring');
    const dampedRows = processedRows('viscous-damped-oscillation');
    const quadraticFallRows = processedRows('fall-quadratic-drag');
    const duffingRows = processedRows('duffing-oscillator');

    expect(mean(constantRows.map((row) => row.a))).toBeCloseTo(2, 0);
    expect(
      meanAbsoluteError(
        simpleSpringRows.map((row) => row.a),
        simpleSpringRows.map((row) => -4 * row.x),
      ),
    ).toBeLessThan(1.2);
    expect(
      meanAbsoluteError(
        dampedRows.map((row) => row.a),
        dampedRows.map((row) => -4 * row.x - 0.45 * row.v),
      ),
    ).toBeLessThan(1.4);
    expect(quadraticFallRows.every((row) => Number.isFinite(row.a) && Number.isFinite(row.v))).toBe(
      true,
    );
    expect(
      meanAbsoluteError(
        duffingRows.map((row) => row.a),
        duffingRows.map((row) => -3 * row.x - row.x ** 3),
      ),
    ).toBeLessThan(1.6);
  });
});
