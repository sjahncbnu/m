import type { DatasetRow, MotionDataset } from '../types/dataset';
import { hasAccelerationValues } from './ols';

const epsilon = 1e-9;

export type NeuralInputKey = 'x' | 'v' | 't';
export type ActivationName = 'ReLU' | 'tanh' | 'sigmoid';
export type EarlyStoppingCriterion = '검증 손실' | '학습 손실';

export type NeuralTrainingConfig = {
  inputKeys: NeuralInputKey[];
  hiddenLayers: number[];
  activation: ActivationName;
  epochs: number;
  learningRate: number;
  batchSize: number;
  l2Regularization: boolean;
  earlyStopping: boolean;
  earlyStoppingCriterion: EarlyStoppingCriterion;
};

export type NeuralTrainingProgress = {
  epoch: number;
  loss: number;
};

export type NeuralTrainingResult = {
  predictions: number[];
  targets: number[];
  mse: number;
  epochsCompleted: number;
  finalLoss: number;
  weights: number[][][];
};

export class NeuralNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NeuralNetworkError';
  }
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

function seededRandom(seed: number) {
  let state = seed;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function activate(value: number, activation: ActivationName) {
  if (activation === 'ReLU') {
    return Math.max(0, value);
  }

  if (activation === 'tanh') {
    return Math.tanh(value);
  }

  return 1 / (1 + Math.exp(-value));
}

function activationDerivative(value: number, activatedValue: number, activation: ActivationName) {
  if (activation === 'ReLU') {
    return value > 0 ? 1 : 0;
  }

  if (activation === 'tanh') {
    return 1 - activatedValue ** 2;
  }

  return activatedValue * (1 - activatedValue);
}

function buildTargetVector(dataset: MotionDataset) {
  if (!hasAccelerationValues(dataset)) {
    throw new NeuralNetworkError('가속도 a 데이터가 없어 목표값을 만들 수 없습니다.');
  }

  return dataset.rows.map((row) => row.a);
}

function getInputValue(row: DatasetRow, key: NeuralInputKey) {
  return row[key];
}

function buildStandardizedInputs(dataset: MotionDataset, inputKeys: NeuralInputKey[]) {
  const rawInputs = dataset.rows.map((row) => inputKeys.map((key) => getInputValue(row, key)));

  if (rawInputs.some((row) => row.some((value) => !Number.isFinite(value)))) {
    throw new NeuralNetworkError('입력 변수에 유효하지 않은 값이 포함되어 있습니다.');
  }

  const means = inputKeys.map((_, columnIndex) =>
    mean(rawInputs.map((row) => row[columnIndex])),
  );
  const scales = inputKeys.map((_, columnIndex) => {
    const scale = standardDeviation(rawInputs.map((row) => row[columnIndex]));
    return scale < epsilon ? 1 : scale;
  });

  return rawInputs.map((row) =>
    row.map((value, columnIndex) => (value - means[columnIndex]) / scales[columnIndex]),
  );
}

function standardizeTargets(targets: number[]) {
  const targetMean = mean(targets);
  const targetScale = standardDeviation(targets);
  const safeScale = targetScale < epsilon ? 1 : targetScale;

  return {
    targetMean,
    targetScale: safeScale,
    standardizedTargets: targets.map((target) => (target - targetMean) / safeScale),
  };
}

function createNetwork(layerSizes: number[]) {
  const random = seededRandom(42);
  const weights = layerSizes.slice(1).map((layerSize, layerIndex) => {
    const previousSize = layerSizes[layerIndex];
    const limit = Math.sqrt(6 / (previousSize + layerSize));

    return Array.from({ length: previousSize }, () =>
      Array.from({ length: layerSize }, () => (random() * 2 - 1) * limit),
    );
  });
  const biases = layerSizes.slice(1).map((layerSize) => Array(layerSize).fill(0));

  return { weights, biases };
}

function forward(
  input: number[],
  weights: number[][][],
  biases: number[][],
  activation: ActivationName,
) {
  const activations = [input];
  const zValues: number[][] = [];

  weights.forEach((layerWeights, layerIndex) => {
    const previous = activations[layerIndex];
    const isOutputLayer = layerIndex === weights.length - 1;
    const z = biases[layerIndex].map((bias, nodeIndex) =>
      previous.reduce(
        (sum, value, previousIndex) => sum + value * layerWeights[previousIndex][nodeIndex],
        bias,
      ),
    );
    const layerOutput = isOutputLayer ? z : z.map((value) => activate(value, activation));

    zValues.push(z);
    activations.push(layerOutput);
  });

  return { activations, zValues, output: activations[activations.length - 1][0] };
}

function predictStandardized(
  inputs: number[][],
  weights: number[][][],
  biases: number[][],
  activation: ActivationName,
) {
  return inputs.map((input) => forward(input, weights, biases, activation).output);
}

function calculateMse(targets: number[], predictions: number[]) {
  return (
    targets.reduce((sum, target, index) => sum + (target - predictions[index]) ** 2, 0) /
    targets.length
  );
}

function getIndexes(rowCount: number) {
  const allIndexes = Array.from({ length: rowCount }, (_, index) => index);

  if (rowCount < 5) {
    return { trainIndexes: allIndexes, validationIndexes: allIndexes };
  }

  return {
    trainIndexes: allIndexes.filter((index) => index % 5 !== 0),
    validationIndexes: allIndexes.filter((index) => index % 5 === 0),
  };
}

async function yieldToBrowser() {
  await new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, 0);
  });
}

export async function trainNeuralNetwork(
  dataset: MotionDataset,
  config: NeuralTrainingConfig,
  onProgress?: (progress: NeuralTrainingProgress) => void,
): Promise<NeuralTrainingResult> {
  if (config.inputKeys.length === 0) {
    throw new NeuralNetworkError('입력 변수를 하나 이상 선택하세요.');
  }

  if (dataset.rows.length === 0) {
    throw new NeuralNetworkError('학습할 데이터 행이 없습니다.');
  }

  if (config.hiddenLayers.some((nodeCount) => nodeCount < 1 || !Number.isFinite(nodeCount))) {
    throw new NeuralNetworkError('각 은닉층의 노드 수는 1 이상이어야 합니다.');
  }

  if (!Number.isFinite(config.epochs) || config.epochs < 1) {
    throw new NeuralNetworkError('학습 epoch는 1 이상이어야 합니다.');
  }

  if (!Number.isFinite(config.learningRate) || config.learningRate <= 0) {
    throw new NeuralNetworkError('학습률은 0보다 큰 숫자여야 합니다.');
  }

  const targets = buildTargetVector(dataset);
  const standardizedInputs = buildStandardizedInputs(dataset, config.inputKeys);
  const { targetMean, targetScale, standardizedTargets } = standardizeTargets(targets);
  const layerSizes = [config.inputKeys.length, ...config.hiddenLayers, 1];
  const { weights, biases } = createNetwork(layerSizes);
  const { trainIndexes, validationIndexes } = getIndexes(dataset.rows.length);
  const batchSize = Math.max(1, Math.min(Math.round(config.batchSize), trainIndexes.length));
  const l2Lambda = config.l2Regularization ? 0.001 : 0;
  const patience = 80;
  let bestLoss = Number.POSITIVE_INFINITY;
  let staleEpochs = 0;
  let epochsCompleted = 0;

  for (let epoch = 1; epoch <= Math.round(config.epochs); epoch += 1) {
    for (let start = 0; start < trainIndexes.length; start += batchSize) {
      const batchIndexes = trainIndexes.slice(start, start + batchSize);
      const weightGradients = weights.map((layer) =>
        layer.map((row) => row.map(() => 0)),
      );
      const biasGradients = biases.map((layer) => layer.map(() => 0));

      batchIndexes.forEach((rowIndex) => {
        const { activations, zValues, output } = forward(
          standardizedInputs[rowIndex],
          weights,
          biases,
          config.activation,
        );
        let delta = [2 * (output - standardizedTargets[rowIndex])];

        for (let layerIndex = weights.length - 1; layerIndex >= 0; layerIndex -= 1) {
          const previousActivation = activations[layerIndex];

          previousActivation.forEach((value, previousIndex) => {
            delta.forEach((deltaValue, nodeIndex) => {
              weightGradients[layerIndex][previousIndex][nodeIndex] += value * deltaValue;
            });
          });
          delta.forEach((deltaValue, nodeIndex) => {
            biasGradients[layerIndex][nodeIndex] += deltaValue;
          });

          if (layerIndex > 0) {
            delta = previousActivation.map((_, previousIndex) => {
              const weightedDelta = delta.reduce(
                (sum, deltaValue, nodeIndex) =>
                  sum + weights[layerIndex][previousIndex][nodeIndex] * deltaValue,
                0,
              );

              return (
                weightedDelta *
                activationDerivative(
                  zValues[layerIndex - 1][previousIndex],
                  activations[layerIndex][previousIndex],
                  config.activation,
                )
              );
            });
          }
        }
      });

      weights.forEach((layer, layerIndex) => {
        layer.forEach((row, previousIndex) => {
          row.forEach((weight, nodeIndex) => {
            const gradient =
              weightGradients[layerIndex][previousIndex][nodeIndex] / batchIndexes.length +
              l2Lambda * weight;
            weights[layerIndex][previousIndex][nodeIndex] -= config.learningRate * gradient;
          });
        });
        biases[layerIndex].forEach((bias, nodeIndex) => {
          biases[layerIndex][nodeIndex] =
            bias - (config.learningRate * biasGradients[layerIndex][nodeIndex]) / batchIndexes.length;
        });
      });
    }

    epochsCompleted = epoch;

    if (epoch % 20 === 0 || epoch === 1 || epoch === Math.round(config.epochs)) {
      const standardizedPredictions = predictStandardized(
        standardizedInputs,
        weights,
        biases,
        config.activation,
      );
      const trainingLoss = calculateMse(
        trainIndexes.map((index) => standardizedTargets[index]),
        trainIndexes.map((index) => standardizedPredictions[index]),
      );
      const validationLoss = calculateMse(
        validationIndexes.map((index) => standardizedTargets[index]),
        validationIndexes.map((index) => standardizedPredictions[index]),
      );
      const watchedLoss =
        config.earlyStoppingCriterion === '검증 손실' ? validationLoss : trainingLoss;

      onProgress?.({
        epoch,
        loss: watchedLoss * targetScale ** 2,
      });

      if (config.earlyStopping) {
        if (watchedLoss + 1e-8 < bestLoss) {
          bestLoss = watchedLoss;
          staleEpochs = 0;
        } else {
          staleEpochs += 20;
        }

        if (staleEpochs >= patience) {
          break;
        }
      }

      await yieldToBrowser();
    }
  }

  const standardizedPredictions = predictStandardized(
    standardizedInputs,
    weights,
    biases,
    config.activation,
  );
  const predictions = standardizedPredictions.map(
    (prediction) => prediction * targetScale + targetMean,
  );

  if (!predictions.every(Number.isFinite)) {
    throw new NeuralNetworkError('신경망 예측값에 유효하지 않은 값이 포함되어 있습니다.');
  }

  const mse = calculateMse(targets, predictions);

  return {
    predictions,
    targets,
    mse,
    epochsCompleted,
    finalLoss: mse,
    weights: weights.map((layer) => layer.map((row) => [...row])),
  };
}
