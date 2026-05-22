import type { DatasetRow, MotionDataset, RawDatasetRow, RawMotionDataset } from '../types/dataset';

export type DerivativeMethod = '전처리 하지 않기' | 'Savitzky-Golay 필터 + 미분';

export type DerivativeSettings = {
  method: DerivativeMethod;
  windowLength: number;
  polynomialOrder: number;
};

export const defaultDerivativeSettings: DerivativeSettings = {
  method: '전처리 하지 않기',
  windowLength: 101,
  polynomialOrder: 2,
};

const centralDifferenceEdgeTrim = 2;

function round(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

export function getRawRows(dataset: RawMotionDataset | MotionDataset): RawDatasetRow[] {
  if ('rawRows' in dataset && dataset.rawRows) {
    return dataset.rawRows;
  }

  if ('rows' in dataset) {
    return dataset.rows.map(({ t, x }) => ({ t, x }));
  }

  return [];
}

export function getSamplingInterval(rawRows: RawDatasetRow[]) {
  if (rawRows.length < 2) {
    return 0;
  }

  const intervals = rawRows.slice(1).map((row, index) => row.t - rawRows[index].t);
  return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
}

export function getTimeRange(rawRows: RawDatasetRow[]) {
  if (rawRows.length === 0) {
    return { min: 0, max: 0 };
  }

  const times = rawRows.map((row) => row.t);
  return { min: Math.min(...times), max: Math.max(...times) };
}

function clampOddWindow(windowLength: number, rowCount: number) {
  const safeCount = Math.max(1, rowCount);
  const oddWindow = Math.max(3, Math.round(windowLength) | 1);
  return Math.min(oddWindow, safeCount % 2 === 0 ? safeCount - 1 : safeCount);
}

function solveLinearSystem(matrix: number[][], vector: number[]) {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let column = 0; column < size; column += 1) {
    let pivotRow = column;

    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivotRow][column])) {
        pivotRow = row;
      }
    }

    if (Math.abs(augmented[pivotRow][column]) < 1e-12) {
      return null;
    }

    [augmented[column], augmented[pivotRow]] = [augmented[pivotRow], augmented[column]];

    const pivot = augmented[column][column];

    for (let valueIndex = column; valueIndex <= size; valueIndex += 1) {
      augmented[column][valueIndex] /= pivot;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === column) {
        continue;
      }

      const factor = augmented[row][column];

      for (let valueIndex = column; valueIndex <= size; valueIndex += 1) {
        augmented[row][valueIndex] -= factor * augmented[column][valueIndex];
      }
    }
  }

  return augmented.map((row) => row[size]);
}

function fitLocalPolynomial(
  rows: RawDatasetRow[],
  centerIndex: number,
  windowLength: number,
  polynomialOrder: number,
) {
  const safeWindow = clampOddWindow(windowLength, rows.length);
  const halfWindow = Math.floor(safeWindow / 2);
  let start = Math.max(0, centerIndex - halfWindow);
  let end = Math.min(rows.length - 1, centerIndex + halfWindow);

  if (end - start + 1 < safeWindow) {
    if (start === 0) {
      end = Math.min(rows.length - 1, safeWindow - 1);
    } else {
      start = Math.max(0, rows.length - safeWindow);
    }
  }

  const samples = rows.slice(start, end + 1);
  const degree = Math.min(Math.max(2, Math.round(polynomialOrder)), samples.length - 1);
  const coefficientCount = degree + 1;
  const normalMatrix = Array.from({ length: coefficientCount }, () =>
    Array(coefficientCount).fill(0),
  );
  const normalVector = Array(coefficientCount).fill(0);
  const centerTime = rows[centerIndex].t;
  const dt = getSamplingInterval(rows) || 1;

  samples.forEach((sample) => {
    const normalizedTime = (sample.t - centerTime) / dt;
    const powers = Array.from({ length: coefficientCount }, (_, index) => normalizedTime ** index);

    for (let row = 0; row < coefficientCount; row += 1) {
      normalVector[row] += powers[row] * sample.x;

      for (let column = 0; column < coefficientCount; column += 1) {
        normalMatrix[row][column] += powers[row] * powers[column];
      }
    }
  });

  return solveLinearSystem(normalMatrix, normalVector) ?? Array(coefficientCount).fill(0);
}

function savitzkyGolayDerivatives(
  rawRows: RawDatasetRow[],
  windowLength: number,
  polynomialOrder: number,
) {
  if (rawRows.length < 3) {
    const times = rawRows.map((row) => row.t);
    const positions = rawRows.map((row) => row.x);
    const velocities = derivative(positions, times);

    return {
      velocityValues: velocities,
      accelerationValues: derivative(velocities, times),
    };
  }

  const dt = getSamplingInterval(rawRows) || 1;
  const velocityValues: number[] = [];
  const accelerationValues: number[] = [];

  rawRows.forEach((_, index) => {
    const coefficients = fitLocalPolynomial(rawRows, index, windowLength, polynomialOrder);

    velocityValues.push((coefficients[1] ?? 0) / dt);
    accelerationValues.push((2 * (coefficients[2] ?? 0)) / dt ** 2);
  });

  return { velocityValues, accelerationValues };
}

function getDerivativeEdgeTrimCount(
  rawRows: RawDatasetRow[],
  settings: DerivativeSettings,
) {
  if (rawRows.length <= centralDifferenceEdgeTrim * 2) {
    return 0;
  }

  if (settings.method === 'Savitzky-Golay 필터 + 미분') {
    const safeWindow = clampOddWindow(settings.windowLength, rawRows.length);
    return Math.min(Math.floor(safeWindow / 2), Math.floor((rawRows.length - 1) / 2));
  }

  return centralDifferenceEdgeTrim;
}

function derivative(values: number[], times: number[]) {
  if (values.length === 0) {
    return [];
  }

  if (values.length === 1) {
    return [0];
  }

  return values.map((value, index) => {
    if (index === 0) {
      return (values[1] - value) / (times[1] - times[0]);
    }

    if (index === values.length - 1) {
      return (value - values[index - 1]) / (times[index] - times[index - 1]);
    }

    return (values[index + 1] - values[index - 1]) / (times[index + 1] - times[index - 1]);
  });
}

export function buildProcessedDataset(
  sourceDataset: RawMotionDataset,
  settings: DerivativeSettings,
): MotionDataset {
  const rawRows = [...sourceDataset.rawRows].sort((left, right) => left.t - right.t);
  const times = rawRows.map((row) => row.t);
  const rawPositionValues = rawRows.map((row) => row.x);
  const derivativeValues =
    settings.method === 'Savitzky-Golay 필터 + 미분'
      ? savitzkyGolayDerivatives(rawRows, settings.windowLength, settings.polynomialOrder)
      : (() => {
          const velocityValues = derivative(rawPositionValues, times);

          return {
            velocityValues,
            accelerationValues: derivative(velocityValues, times),
          };
        })();
  const edgeTrimCount = getDerivativeEdgeTrimCount(rawRows, settings);
  const validRawRows =
    edgeTrimCount > 0 ? rawRows.slice(edgeTrimCount, rawRows.length - edgeTrimCount) : rawRows;

  return {
    id: `${sourceDataset.id}-processed`,
    name: `${sourceDataset.name} 처리 데이터`,
    sourceId: sourceDataset.id,
    sourceName: sourceDataset.name,
    rawRows,
    rows: validRawRows.map(
      (row, visibleIndex) => {
        const index = visibleIndex + edgeTrimCount;

        return {
          t: round(row.t),
          x: round(row.x),
          v: round(derivativeValues.velocityValues[index]),
          a: round(derivativeValues.accelerationValues[index]),
        } satisfies DatasetRow;
      },
    ),
  };
}
