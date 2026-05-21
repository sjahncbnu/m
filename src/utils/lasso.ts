import type { MotionDataset } from '../types/dataset';
import { buildFeatureMatrix } from './formula';
import { hasAccelerationValues } from './ols';

const zeroTolerance = 1e-8;
const displayZeroThreshold = 1e-6;

export type LassoFitOptions = {
  lambda: number;
  standardize: boolean;
  maxIterations?: number;
  tolerance?: number;
};

export type LassoValidationMode = '전체 데이터 사용' | '5-fold 교차검증';

export type LassoAnalysisOptions = LassoFitOptions & {
  autoSearch: boolean;
  validationMode: LassoValidationMode;
  lambdaGrid?: number[];
  foldCount?: number;
};

export type LassoCoefficient = {
  coefficient: number;
  term: string;
  status: '선택됨' | '제거됨';
};

export type LassoFitResult = {
  coefficients: LassoCoefficient[];
  predictions: number[];
  rSquared: number;
  mae: number;
  selectedTerms: string[];
  removedTerms: string[];
  selectedTermCount: number;
  lambdaUsed: number;
  interceptOffset: number;
};

export type LassoValidationPoint = {
  lambda: number;
  validationMse: number;
};

export type LassoAnalysisResult = LassoFitResult & {
  optimalLambda: number;
  validationMse: number;
  validationCurve: LassoValidationPoint[];
  validationMode: LassoValidationMode;
};

export class LassoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LassoError';
  }
}

function softThreshold(value: number, lambda: number) {
  if (value > lambda) {
    return value - lambda;
  }

  if (value < -lambda) {
    return value + lambda;
  }

  return 0;
}

function getTargetVector(dataset: MotionDataset, mass: number) {
  if (!hasAccelerationValues(dataset)) {
    throw new LassoError('가속도 a 값이 없어 목표값을 만들 수 없습니다.');
  }

  return dataset.rows.map((row) => mass * row.a);
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  const valuesMean = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - valuesMean) ** 2, 0) / values.length;

  return Math.sqrt(variance);
}

function isInterceptTerm(term: string) {
  return term.trim() === '1';
}

function prepareFeatures(rawFeatures: number[][], terms: string[], standardize: boolean) {
  const rowCount = rawFeatures.length;
  const columnCount = rawFeatures[0]?.length ?? 0;
  const means = Array(columnCount).fill(0);
  const scales = Array(columnCount).fill(1);
  const interceptIndex = terms.findIndex(isInterceptTerm);

  const features = rawFeatures.map((row) => [...row]);

  if (!standardize) {
    return { features, means, scales, interceptIndex };
  }

  for (let col = 0; col < columnCount; col += 1) {
    if (col === interceptIndex) {
      continue;
    }

    const columnValues = rawFeatures.map((row) => row[col]);
    const columnMean = mean(columnValues);
    const columnScale = standardDeviation(columnValues);

    if (columnScale < zeroTolerance) {
      continue;
    }

    means[col] = columnMean;
    scales[col] = columnScale;

    for (let row = 0; row < rowCount; row += 1) {
      features[row][col] = (rawFeatures[row][col] - columnMean) / columnScale;
    }
  }

  return { features, means, scales, interceptIndex };
}

function coordinateDescent(
  features: number[][],
  targets: number[],
  lambda: number,
  interceptIndex: number,
  maxIterations: number,
  tolerance: number,
) {
  const rowCount = features.length;
  const columnCount = features[0]?.length ?? 0;
  const coefficients = Array(columnCount).fill(0);
  const predictions = Array(rowCount).fill(0);

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let maxChange = 0;

    for (let col = 0; col < columnCount; col += 1) {
      let numerator = 0;
      let denominator = 0;

      for (let row = 0; row < rowCount; row += 1) {
        const featureValue = features[row][col];
        const residualWithoutCurrent =
          targets[row] - predictions[row] + featureValue * coefficients[col];

        numerator += featureValue * residualWithoutCurrent;
        denominator += featureValue * featureValue;
      }

      if (denominator < zeroTolerance) {
        continue;
      }

      const oldCoefficient = coefficients[col];
      const averageNumerator = numerator / rowCount;
      const averageDenominator = denominator / rowCount;
      const shouldPenalize = col !== interceptIndex;
      const nextCoefficient = shouldPenalize
        ? softThreshold(averageNumerator, lambda) / averageDenominator
        : averageNumerator / averageDenominator;

      coefficients[col] = nextCoefficient;

      const delta = nextCoefficient - oldCoefficient;

      if (Math.abs(delta) > 0) {
        for (let row = 0; row < rowCount; row += 1) {
          predictions[row] += features[row][col] * delta;
        }
      }

      maxChange = Math.max(maxChange, Math.abs(delta));
    }

    if (maxChange < tolerance) {
      break;
    }
  }

  return coefficients;
}

function convertToOriginalScale(
  scaledCoefficients: number[],
  rawFeatures: number[][],
  means: number[],
  scales: number[],
  interceptIndex: number,
) {
  const coefficients = scaledCoefficients.map((coefficient, index) => coefficient / scales[index]);
  const offset = scaledCoefficients.reduce(
    (sum, coefficient, index) => sum - (coefficient * means[index]) / scales[index],
    0,
  );

  if (interceptIndex >= 0) {
    const interceptColumnValue = rawFeatures[0]?.[interceptIndex] ?? 1;

    if (Math.abs(interceptColumnValue) > zeroTolerance) {
      coefficients[interceptIndex] += offset / interceptColumnValue;
      return { coefficients, interceptOffset: 0 };
    }
  }

  return { coefficients, interceptOffset: offset };
}

function predictRows(
  rawFeatures: number[][],
  coefficients: number[],
  interceptOffset: number,
) {
  return rawFeatures.map(
    (row) =>
      interceptOffset +
      row.reduce((sum, value, index) => sum + value * coefficients[index], 0),
  );
}

function predictDatasetRows(
  terms: string[],
  dataset: MotionDataset,
  coefficients: number[],
  interceptOffset: number,
) {
  const rawFeatures = buildFeatureMatrix(terms, dataset);
  return predictRows(rawFeatures, coefficients, interceptOffset);
}

function calculateRSquared(targets: number[], predictions: number[]) {
  const targetMean = mean(targets);
  const totalSumSquares = targets.reduce((sum, value) => sum + (value - targetMean) ** 2, 0);
  const residualSumSquares = targets.reduce(
    (sum, value, index) => sum + (value - predictions[index]) ** 2,
    0,
  );

  if (totalSumSquares < zeroTolerance) {
    return residualSumSquares < zeroTolerance ? 1 : 0;
  }

  return 1 - residualSumSquares / totalSumSquares;
}

export function calculateMse(targets: number[], predictions: number[]) {
  return (
    targets.reduce((sum, value, index) => sum + (value - predictions[index]) ** 2, 0) /
    targets.length
  );
}

function calculateMae(targets: number[], predictions: number[]) {
  return (
    targets.reduce((sum, value, index) => sum + Math.abs(value - predictions[index]), 0) /
    targets.length
  );
}

export function formatLassoCoefficient(value: number) {
  if (Math.abs(value) < displayZeroThreshold) {
    return '0';
  }

  return value.toFixed(4);
}

export function buildLogLambdaGrid(min = 0.001, max = 10, count = 13) {
  if (count <= 1) {
    return [min];
  }

  const logMin = Math.log10(min);
  const logMax = Math.log10(max);
  const step = (logMax - logMin) / (count - 1);

  return Array.from({ length: count }, (_, index) => {
    const value = 10 ** (logMin + step * index);
    return Number(value.toPrecision(4));
  });
}

function createDatasetSlice(dataset: MotionDataset, rowIndexes: number[], suffix: string) {
  return {
    id: `${dataset.id}-${suffix}`,
    name: dataset.name,
    rows: rowIndexes.map((index) => dataset.rows[index]),
  } satisfies MotionDataset;
}

function getFoldIndexes(rowCount: number, requestedFoldCount: number) {
  const foldCount = Math.min(Math.max(requestedFoldCount, 2), rowCount);
  const folds: number[][] = Array.from({ length: foldCount }, () => []);

  for (let index = 0; index < rowCount; index += 1) {
    folds[index % foldCount].push(index);
  }

  return folds;
}

function getValidationMseForFullDataset(
  terms: string[],
  dataset: MotionDataset,
  mass: number,
  options: LassoFitOptions,
) {
  const result = fitLassoRegression(terms, dataset, mass, options);
  const targets = getTargetVector(dataset, mass);
  return calculateMse(targets, result.predictions);
}

function getCrossValidationMse(
  terms: string[],
  dataset: MotionDataset,
  mass: number,
  options: LassoFitOptions,
  foldCount: number,
) {
  if (dataset.rows.length < 2) {
    return getValidationMseForFullDataset(terms, dataset, mass, options);
  }

  const folds = getFoldIndexes(dataset.rows.length, foldCount);
  const allIndexes = dataset.rows.map((_, index) => index);
  let weightedMseSum = 0;
  let validationRowCount = 0;

  folds.forEach((validationIndexes, foldIndex) => {
    if (validationIndexes.length === 0) {
      return;
    }

    const validationIndexSet = new Set(validationIndexes);
    const trainIndexes = allIndexes.filter((index) => !validationIndexSet.has(index));

    if (trainIndexes.length === 0) {
      return;
    }

    const trainDataset = createDatasetSlice(dataset, trainIndexes, `train-${foldIndex}`);
    const validationDataset = createDatasetSlice(
      dataset,
      validationIndexes,
      `validation-${foldIndex}`,
    );
    const fit = fitLassoRegression(terms, trainDataset, mass, options);
    const predictions = predictDatasetRows(
      terms.map((term) => term.trim()).filter(Boolean),
      validationDataset,
      fit.coefficients.map((coefficient) => coefficient.coefficient),
      fit.interceptOffset,
    );
    const targets = getTargetVector(validationDataset, mass);
    const foldMse = calculateMse(targets, predictions);

    weightedMseSum += foldMse * validationIndexes.length;
    validationRowCount += validationIndexes.length;
  });

  if (validationRowCount === 0) {
    return getValidationMseForFullDataset(terms, dataset, mass, options);
  }

  return weightedMseSum / validationRowCount;
}

export function fitLassoRegression(
  terms: string[],
  dataset: MotionDataset,
  mass: number,
  options: LassoFitOptions,
): LassoFitResult {
  const activeTerms = terms.map((term) => term.trim()).filter(Boolean);

  if (activeTerms.length === 0) {
    throw new LassoError('피팅할 후보 항을 하나 이상 입력하세요.');
  }

  if (!Number.isFinite(mass)) {
    throw new LassoError('질량 m은 숫자로 입력해야 합니다.');
  }

  if (!Number.isFinite(options.lambda) || options.lambda < 0) {
    throw new LassoError('λ 값은 0 이상의 숫자로 입력해야 합니다.');
  }

  if (dataset.rows.length === 0) {
    throw new LassoError('피팅할 데이터 행이 없습니다.');
  }

  const rawFeatures = buildFeatureMatrix(activeTerms, dataset);
  const targets = getTargetVector(dataset, mass);
  const { features, means, scales, interceptIndex } = prepareFeatures(
    rawFeatures,
    activeTerms,
    options.standardize,
  );
  const scaledCoefficients = coordinateDescent(
    features,
    targets,
    options.lambda,
    interceptIndex,
    options.maxIterations ?? 5000,
    options.tolerance ?? 1e-7,
  );
  const { coefficients, interceptOffset } = convertToOriginalScale(
    scaledCoefficients,
    rawFeatures,
    means,
    scales,
    interceptIndex,
  );
  const predictions = predictRows(rawFeatures, coefficients, interceptOffset);
  const coefficientRows = activeTerms.map((term, index) => {
    const coefficient =
      Math.abs(coefficients[index]) < displayZeroThreshold ? 0 : coefficients[index];

    return {
      coefficient,
      term,
      status: Math.abs(coefficient) < displayZeroThreshold ? '제거됨' : '선택됨',
    } satisfies LassoCoefficient;
  });
  const selectedTerms = coefficientRows
    .filter((coefficient) => coefficient.status === '선택됨')
    .map((coefficient) => coefficient.term);
  const removedTerms = coefficientRows
    .filter((coefficient) => coefficient.status === '제거됨')
    .map((coefficient) => coefficient.term);

  return {
    coefficients: coefficientRows,
    predictions,
    rSquared: calculateRSquared(targets, predictions),
    mae: calculateMae(targets, predictions),
    selectedTerms,
    removedTerms,
    selectedTermCount: selectedTerms.length,
    lambdaUsed: options.lambda,
    interceptOffset,
  };
}

export function fitLassoAnalysis(
  terms: string[],
  dataset: MotionDataset,
  mass: number,
  options: LassoAnalysisOptions,
): LassoAnalysisResult {
  const lambdaGrid = options.autoSearch
    ? (options.lambdaGrid ?? buildLogLambdaGrid()).filter(
        (lambda) => Number.isFinite(lambda) && lambda >= 0,
      )
    : [options.lambda];

  if (lambdaGrid.length === 0) {
    throw new LassoError('탐색할 λ 후보가 없습니다.');
  }

  const validationCurve = lambdaGrid.map((lambda) => ({
    lambda,
    validationMse:
      options.validationMode === '5-fold 교차검증'
        ? getCrossValidationMse(
            terms,
            dataset,
            mass,
            {
              lambda,
              standardize: options.standardize,
              maxIterations: options.maxIterations,
              tolerance: options.tolerance,
            },
            options.foldCount ?? 5,
          )
        : getValidationMseForFullDataset(terms, dataset, mass, {
            lambda,
            standardize: options.standardize,
            maxIterations: options.maxIterations,
            tolerance: options.tolerance,
          }),
  }));

  const bestPoint = validationCurve.reduce((best, point) =>
    point.validationMse < best.validationMse ? point : best,
  );
  const finalResult = fitLassoRegression(terms, dataset, mass, {
    lambda: bestPoint.lambda,
    standardize: options.standardize,
    maxIterations: options.maxIterations,
    tolerance: options.tolerance,
  });

  return {
    ...finalResult,
    optimalLambda: bestPoint.lambda,
    validationMse: bestPoint.validationMse,
    validationCurve,
    validationMode: options.validationMode,
  };
}
