import type { MotionDataset } from '../types/dataset';
import { buildFeatureMatrix } from './formula';

const singularTolerance = 1e-10;

export type OlsFitResult = {
  coefficients: number[];
  predictions: number[];
  rSquared: number;
  mae: number;
  mse: number;
};

export class OlsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OlsError';
  }
}

export function hasAccelerationValues(dataset: MotionDataset) {
  return (
    dataset.rows.length > 0 &&
    dataset.rows.every((row) => Number.isFinite((row as { a?: number }).a))
  );
}

function buildTargetVector(dataset: MotionDataset) {
  if (!hasAccelerationValues(dataset)) {
    throw new OlsError('가속도 a 값이 없어 목표값을 만들 수 없습니다.');
  }

  return dataset.rows.map((row) => row.a);
}

function transposeMultiplyMatrix(matrix: number[][]) {
  const columnCount = matrix[0]?.length ?? 0;
  const result = Array.from({ length: columnCount }, () => Array(columnCount).fill(0));

  matrix.forEach((row) => {
    for (let col = 0; col < columnCount; col += 1) {
      for (let nextCol = 0; nextCol < columnCount; nextCol += 1) {
        result[col][nextCol] += row[col] * row[nextCol];
      }
    }
  });

  return result;
}

function transposeMultiplyVector(matrix: number[][], vector: number[]) {
  const columnCount = matrix[0]?.length ?? 0;
  const result = Array(columnCount).fill(0);

  matrix.forEach((row, rowIndex) => {
    for (let col = 0; col < columnCount; col += 1) {
      result[col] += row[col] * vector[rowIndex];
    }
  });

  return result;
}

function solveLinearSystem(matrix: number[][], vector: number[]) {
  const size = vector.length;
  const augmented = matrix.map((row, rowIndex) => [...row, vector[rowIndex]]);

  for (let pivotIndex = 0; pivotIndex < size; pivotIndex += 1) {
    let bestRow = pivotIndex;
    let bestValue = Math.abs(augmented[pivotIndex][pivotIndex]);

    for (let rowIndex = pivotIndex + 1; rowIndex < size; rowIndex += 1) {
      const candidateValue = Math.abs(augmented[rowIndex][pivotIndex]);

      if (candidateValue > bestValue) {
        bestRow = rowIndex;
        bestValue = candidateValue;
      }
    }

    if (bestValue < singularTolerance) {
      throw new OlsError('행렬이 특이하여 계수를 추정할 수 없습니다. 서로 중복되거나 종속된 항을 줄여 주세요.');
    }

    if (bestRow !== pivotIndex) {
      [augmented[pivotIndex], augmented[bestRow]] = [augmented[bestRow], augmented[pivotIndex]];
    }

    const pivotValue = augmented[pivotIndex][pivotIndex];

    for (let col = pivotIndex; col <= size; col += 1) {
      augmented[pivotIndex][col] /= pivotValue;
    }

    for (let rowIndex = 0; rowIndex < size; rowIndex += 1) {
      if (rowIndex === pivotIndex) {
        continue;
      }

      const factor = augmented[rowIndex][pivotIndex];

      for (let col = pivotIndex; col <= size; col += 1) {
        augmented[rowIndex][col] -= factor * augmented[pivotIndex][col];
      }
    }
  }

  return augmented.map((row) => row[size]);
}

function predictRows(featureMatrix: number[][], coefficients: number[]) {
  return featureMatrix.map((row) =>
    row.reduce((sum, value, index) => sum + value * coefficients[index], 0),
  );
}

function calculateRSquared(targets: number[], predictions: number[]) {
  const targetMean = targets.reduce((sum, value) => sum + value, 0) / targets.length;
  const totalSumSquares = targets.reduce((sum, value) => sum + (value - targetMean) ** 2, 0);
  const residualSumSquares = targets.reduce(
    (sum, value, index) => sum + (value - predictions[index]) ** 2,
    0,
  );

  if (totalSumSquares < singularTolerance) {
    return residualSumSquares < singularTolerance ? 1 : 0;
  }

  return 1 - residualSumSquares / totalSumSquares;
}

function calculateMae(targets: number[], predictions: number[]) {
  return (
    targets.reduce((sum, value, index) => sum + Math.abs(value - predictions[index]), 0) /
    targets.length
  );
}

function calculateMse(targets: number[], predictions: number[]) {
  return (
    targets.reduce((sum, value, index) => sum + (value - predictions[index]) ** 2, 0) /
    targets.length
  );
}

export function fitOrdinaryLeastSquares(terms: string[], dataset: MotionDataset): OlsFitResult {
  const activeTerms = terms.map((term) => term.trim()).filter(Boolean);

  if (activeTerms.length === 0) {
    throw new OlsError('피팅할 항을 하나 이상 입력하세요.');
  }

  if (dataset.rows.length === 0) {
    throw new OlsError('피팅할 데이터 행이 없습니다.');
  }

  if (dataset.rows.length < activeTerms.length) {
    throw new OlsError('데이터 행 수가 항 개수보다 적어 계수를 안정적으로 추정할 수 없습니다.');
  }

  const featureMatrix = buildFeatureMatrix(activeTerms, dataset);
  const targetVector = buildTargetVector(dataset);
  const normalMatrix = transposeMultiplyMatrix(featureMatrix);
  const normalVector = transposeMultiplyVector(featureMatrix, targetVector);
  const coefficients = solveLinearSystem(normalMatrix, normalVector);
  const predictions = predictRows(featureMatrix, coefficients);

  return {
    coefficients,
    predictions,
    rSquared: calculateRSquared(targetVector, predictions),
    mae: calculateMae(targetVector, predictions),
    mse: calculateMse(targetVector, predictions),
  };
}
