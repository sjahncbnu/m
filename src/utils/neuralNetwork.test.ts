import { describe, expect, it } from 'vitest';
import { demoDataset } from '../data/demoDataset';
import { runSymbolicDistillation } from './distillation';
import { buildProcessedDataset, defaultDerivativeSettings } from './derivatives';
import { trainNeuralNetwork } from './neuralNetwork';

describe('neural network distillation utilities', () => {
  it('trains a browser-safe neural network and returns finite predictions', async () => {
    const processedDataset = buildProcessedDataset(demoDataset, defaultDerivativeSettings);
    const result = await trainNeuralNetwork(processedDataset, {
      inputKeys: ['x', 'v', 't'],
      hiddenLayers: [4, 3],
      activation: 'ReLU',
      epochs: 40,
      learningRate: 0.001,
      batchSize: 4,
      l2Regularization: true,
      earlyStopping: false,
      earlyStoppingCriterion: '검증 손실',
    });

    expect(result.predictions).toHaveLength(processedDataset.rows.length);
    expect(result.predictions.every(Number.isFinite)).toBe(true);
    expect(Number.isFinite(result.mse)).toBe(true);
    expect(result.weights).toHaveLength(3);
  });

  it('distills neural predictions into a symbolic Lasso result', () => {
    const processedDataset = buildProcessedDataset(demoDataset, defaultDerivativeSettings);
    const predictions = processedDataset.rows.map(() => 9.8);
    const result = runSymbolicDistillation(['1', 'x', 'v'], processedDataset, predictions, {
      lambda: 0.01,
      standardize: true,
      autoSearch: false,
      validationMode: '전체 데이터 사용',
    });

    expect(result.extractedFormula).toContain('â_NN');
    expect(result.distillationMse).toBeCloseTo(0);
    expect(result.lassoResult.coefficients[0].status).toBe('선택됨');
  });
});
