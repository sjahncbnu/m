import type { MotionDataset } from '../types/dataset';
import {
  calculateMse,
  fitLassoAnalysisWithTarget,
  formatLassoCoefficient,
  type LassoAnalysisOptions,
  type LassoAnalysisResult,
} from './lasso';

export type DistillationResult = {
  lassoResult: LassoAnalysisResult;
  distillationMse: number;
  extractedFormula: string;
};

export class DistillationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DistillationError';
  }
}

function formatTerm(coefficient: number, term: string, isFirst: boolean) {
  const sign = coefficient < 0 ? '-' : isFirst ? '' : '+';
  const absCoefficient = formatLassoCoefficient(Math.abs(coefficient));
  const body = term.trim() === '1' ? absCoefficient : `${absCoefficient}${term.trim()}`;

  return `${sign ? `${sign} ` : ''}${body}`;
}

export function buildExtractedFormula(result: LassoAnalysisResult) {
  const selectedCoefficients = result.coefficients.filter(
    (coefficient) => coefficient.status === '선택됨',
  );

  if (selectedCoefficients.length === 0 && Math.abs(result.interceptOffset) < 1e-6) {
    return 'â_NN ≈ 0';
  }

  const terms = selectedCoefficients.map((coefficient, index) =>
    formatTerm(coefficient.coefficient, coefficient.term, index === 0),
  );

  if (Math.abs(result.interceptOffset) >= 1e-6) {
    terms.unshift(formatTerm(result.interceptOffset, '1', true));
  }

  return `â_NN ≈ ${terms.join(' ')}`;
}

export function runSymbolicDistillation(
  terms: string[],
  dataset: MotionDataset,
  neuralPredictions: number[],
  options: LassoAnalysisOptions,
): DistillationResult {
  if (neuralPredictions.length === 0) {
    throw new DistillationError('먼저 신경망을 학습하여 NN 예측값을 생성하세요.');
  }

  if (neuralPredictions.length !== dataset.rows.length) {
    throw new DistillationError('NN 예측값 개수가 데이터 행 수와 일치하지 않습니다.');
  }

  if (!neuralPredictions.every(Number.isFinite)) {
    throw new DistillationError('NN 예측값에 유효하지 않은 값이 포함되어 있습니다.');
  }

  const lassoResult = fitLassoAnalysisWithTarget(terms, dataset, neuralPredictions, options);

  return {
    lassoResult,
    distillationMse: calculateMse(neuralPredictions, lassoResult.predictions),
    extractedFormula: buildExtractedFormula(lassoResult),
  };
}
