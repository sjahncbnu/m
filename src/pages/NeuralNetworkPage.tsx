import { Play, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  CoefficientMagnitudeChart,
  PredictionComparisonChart,
  ValidationErrorChart,
} from '../components/DistillationCharts';
import { NeuralNetworkDiagram } from '../components/NeuralNetworkDiagram';
import { PlaceholderCard } from '../components/PlaceholderCard';
import type { MotionDataset } from '../types/dataset';
import { buildFeatureMatrix, parseTerm } from '../utils/formula';
import {
  formatLassoCoefficient,
  type LassoAnalysisResult,
  type LassoValidationMode,
} from '../utils/lasso';
import {
  trainNeuralNetwork,
  type ActivationName,
  type EarlyStoppingCriterion,
  type NeuralInputKey,
  type NeuralTrainingResult,
} from '../utils/neuralNetwork';
import { runSymbolicDistillation, type DistillationResult } from '../utils/distillation';
import { hasAccelerationValues } from '../utils/ols';

type NeuralNetworkPageProps = {
  selectedDataset: MotionDataset;
};

type TrainingStatus = '준비 완료' | '학습 중...' | '학습 완료' | '오류 발생';

const neuralInputKeys: NeuralInputKey[] = ['t', 'x', 'v'];
const activationOptions: ActivationName[] = ['ReLU', 'tanh', 'sigmoid'];
const validationModes: LassoValidationMode[] = ['전체 데이터 사용', '5-fold 교차검증'];
const earlyStoppingCriteria: EarlyStoppingCriterion[] = ['검증 손실', '학습 손실'];
const defaultTerms = ['1', 'x', 'v', 'v^2', 'x*v'];

function formatMetric(value: number) {
  if (!Number.isFinite(value)) {
    return '-';
  }

  if (value !== 0 && (Math.abs(value) >= 1000 || Math.abs(value) < 0.001)) {
    return value.toExponential(3);
  }

  return value.toFixed(4);
}

function getTimeRange(dataset: MotionDataset) {
  if (dataset.rows.length === 0) {
    return '-';
  }

  const times = dataset.rows.map((row) => row.t).filter(Number.isFinite);

  if (times.length === 0) {
    return '-';
  }

  return `${Math.min(...times).toFixed(2)} ~ ${Math.max(...times).toFixed(2)} s`;
}

function getTermErrors(terms: string[], dataset: MotionDataset) {
  return terms.map((term) => {
    try {
      parseTerm(term);
      buildFeatureMatrix([term], dataset);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : '항을 해석할 수 없습니다.';
    }
  });
}

function buildCandidatePreview(terms: string[]) {
  if (terms.length === 0) {
    return 'â_NN ≈ 항 없음';
  }

  return `â_NN ≈ ${terms
    .map((term, index) => `c${index}·${term.trim() || '(빈 항)'}`)
    .join(' + ')}`;
}

export function NeuralNetworkPage({ selectedDataset }: NeuralNetworkPageProps) {
  const [hiddenLayers, setHiddenLayers] = useState([4, 3]);
  const [activation, setActivation] = useState<ActivationName>('ReLU');
  const [epochs, setEpochs] = useState('1000');
  const [learningRate, setLearningRate] = useState('0.001');
  const [batchSize, setBatchSize] = useState('16');
  const [l2Regularization, setL2Regularization] = useState(true);
  const [earlyStopping, setEarlyStopping] = useState(true);
  const [earlyStoppingCriterion, setEarlyStoppingCriterion] =
    useState<EarlyStoppingCriterion>('검증 손실');
  const [terms, setTerms] = useState(defaultTerms);
  const [lambda, setLambda] = useState('0.12');
  const [standardizeTerms, setStandardizeTerms] = useState(true);
  const [validationMode, setValidationMode] =
    useState<LassoValidationMode>('5-fold 교차검증');
  const [trainingStatus, setTrainingStatus] = useState<TrainingStatus>('준비 완료');
  const [trainingProgress, setTrainingProgress] = useState({ epoch: 0, loss: 0 });
  const [trainingResult, setTrainingResult] = useState<NeuralTrainingResult | null>(null);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [distillationResult, setDistillationResult] = useState<DistillationResult | null>(null);
  const [distillationError, setDistillationError] = useState<string | null>(null);

  const parsedEpochs = Number(epochs);
  const parsedLearningRate = Number(learningRate);
  const parsedBatchSize = Number(batchSize);
  const parsedLambda = Number(lambda);
  const hasAcceleration = hasAccelerationValues(selectedDataset);
  const termErrors = useMemo(() => getTermErrors(terms, selectedDataset), [terms, selectedDataset]);
  const hasInvalidTerms = termErrors.some(Boolean);
  const canTrain =
    hasAcceleration &&
    selectedDataset.rows.length > 0 &&
    Number.isFinite(parsedEpochs) &&
    parsedEpochs > 0 &&
    Number.isFinite(parsedLearningRate) &&
    parsedLearningRate > 0 &&
    Number.isFinite(parsedBatchSize) &&
    parsedBatchSize > 0 &&
    trainingStatus !== '학습 중...';
  const canDistill =
    Boolean(trainingResult) &&
    !hasInvalidTerms &&
    terms.length > 0 &&
    Number.isFinite(parsedLambda) &&
    parsedLambda >= 0;
  const distillationLassoResult: LassoAnalysisResult | null =
    distillationResult?.lassoResult ?? null;

  useEffect(() => {
    setTrainingResult(null);
    setDistillationResult(null);
    setTrainingError(null);
    setDistillationError(null);
    setTrainingStatus('준비 완료');
    setTrainingProgress({ epoch: 0, loss: 0 });
  }, [
    selectedDataset.id,
    hiddenLayers,
    activation,
    epochs,
    learningRate,
    batchSize,
    l2Regularization,
    earlyStopping,
    earlyStoppingCriterion,
  ]);

  useEffect(() => {
    setDistillationResult(null);
    setDistillationError(null);
  }, [terms, lambda, standardizeTerms, validationMode]);

  const setHiddenLayerCount = (count: number) => {
    const safeCount = Math.max(1, Math.min(4, Math.round(count)));

    setHiddenLayers((currentLayers) =>
      Array.from({ length: safeCount }, (_, index) => currentLayers[index] ?? 3),
    );
  };

  const updateHiddenLayerNode = (index: number, value: string) => {
    const nodeCount = Math.max(1, Math.min(12, Math.round(Number(value) || 1)));

    setHiddenLayers((currentLayers) =>
      currentLayers.map((count, layerIndex) => (layerIndex === index ? nodeCount : count)),
    );
  };

  const addLayer = () => {
    setHiddenLayers((currentLayers) => [...currentLayers, 3].slice(0, 4));
  };

  const removeLayer = () => {
    setHiddenLayers((currentLayers) =>
      currentLayers.length > 1 ? currentLayers.slice(0, -1) : currentLayers,
    );
  };

  const updateTerm = (index: number, value: string) => {
    setTerms((currentTerms) =>
      currentTerms.map((term, termIndex) => (termIndex === index ? value : term)),
    );
  };

  const addTerm = () => {
    setTerms((currentTerms) => [...currentTerms, '']);
  };

  const deleteTerm = (index: number) => {
    setTerms((currentTerms) => currentTerms.filter((_, termIndex) => termIndex !== index));
  };

  const runTraining = async () => {
    if (!canTrain) {
      return;
    }

    try {
      setTrainingStatus('학습 중...');
      setTrainingError(null);
      setTrainingResult(null);
      setDistillationResult(null);
      setDistillationError(null);
      const result = await trainNeuralNetwork(
        selectedDataset,
        {
          inputKeys: neuralInputKeys,
          hiddenLayers,
          activation,
          epochs: parsedEpochs,
          learningRate: parsedLearningRate,
          batchSize: parsedBatchSize,
          l2Regularization,
          earlyStopping,
          earlyStoppingCriterion,
        },
        (progress) => setTrainingProgress(progress),
      );

      setTrainingResult(result);
      setTrainingProgress({ epoch: result.epochsCompleted, loss: result.finalLoss });
      setTrainingStatus('학습 완료');
    } catch (error) {
      setTrainingResult(null);
      setTrainingStatus('오류 발생');
      setTrainingError(
        error instanceof Error ? error.message : '신경망 학습 중 알 수 없는 문제가 발생했습니다.',
      );
    }
  };

  const runDistillation = () => {
    if (!trainingResult || !canDistill) {
      return;
    }

    try {
      setDistillationError(null);
      setDistillationResult(
        runSymbolicDistillation(terms, selectedDataset, trainingResult.predictions, {
          lambda: parsedLambda,
          standardize: standardizeTerms,
          validationMode,
          autoSearch: validationMode === '5-fold 교차검증',
        }),
      );
    } catch (error) {
      setDistillationResult(null);
      setDistillationError(
        error instanceof Error ? error.message : '식 추출 중 알 수 없는 문제가 발생했습니다.',
      );
    }
  };

  return (
    <main className="mx-auto max-w-[1800px] px-6 py-5">
      <div className="grid grid-cols-3 gap-4">
        <PlaceholderCard title="1. 데이터 및 목표값">
          <div className="mt-5 space-y-4">
            <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-sm font-semibold text-blue-800">
                선택된 데이터셋: {selectedDataset.name}
              </p>
              <p className="mt-1 text-sm font-medium text-blue-700">
                데이터 포인트: {selectedDataset.rows.length}개 · 시간 범위: {getTimeRange(selectedDataset)}
              </p>
            </div>

            <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-base font-semibold text-blue-800">
              목표값: 가속도 a
            </div>

            {!hasAcceleration && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                가속도 a 데이터가 없어 목표값을 만들 수 없습니다.
              </div>
            )}

            <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    {['t (s)', 'x (m)', 'v (m/s)', 'a (m/s²)'].map((header) => (
                      <th key={header} className="border-b border-slate-200 px-3 py-2 text-right font-semibold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedDataset.rows.slice(0, 5).map((row, index) => (
                    <tr key={`nn-preview-${selectedDataset.id}-${index}`} className="odd:bg-white even:bg-slate-50">
                      <td className="border-b border-slate-100 px-3 py-2 text-right font-medium text-slate-700">{row.t}</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-right font-medium text-slate-700">{row.x}</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-right font-medium text-slate-700">{row.v}</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-right font-medium text-slate-700">{row.a}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
              측정된 가속도 데이터를 학습 목표로 사용합니다.
            </p>
          </div>
        </PlaceholderCard>

        <PlaceholderCard title="2. 신경망 구조 설계" className="col-span-1">
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">입력 노드</p>
                <div className="flex gap-2">
                  {neuralInputKeys.map((input) => (
                    <span
                      key={input}
                      className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700"
                    >
                      {input}
                    </span>
                  ))}
                </div>
              </div>
              <label>
                <span className="text-sm font-semibold text-slate-700">은닉층 수</span>
                <input
                  type="number"
                  min="1"
                  max="4"
                  value={hiddenLayers.length}
                  onChange={(event) => setHiddenLayerCount(Number(event.target.value))}
                  className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-700">활성화 함수</span>
                <select
                  value={activation}
                  onChange={(event) => setActivation(event.target.value as ActivationName)}
                  className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  {activationOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-700">학습 epoch</span>
                <input
                  type="number"
                  min="1"
                  value={epochs}
                  onChange={(event) => setEpochs(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">노드 수 (각 층)</p>
              <div className="flex flex-wrap gap-2">
                {hiddenLayers.map((nodeCount, index) => (
                  <label key={`hidden-${index}`} className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                    은닉층 {index + 1}
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={nodeCount}
                      onChange={(event) => updateHiddenLayerNode(index, event.target.value)}
                      className="w-16 rounded-md border border-slate-200 bg-white px-2 py-1 text-center outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                ))}
              </div>
            </div>

            <NeuralNetworkDiagram
              inputKeys={neuralInputKeys}
              hiddenLayers={hiddenLayers}
              weights={trainingResult?.weights}
            />

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={addLayer}
                className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                층 추가
              </button>
              <button
                type="button"
                onClick={removeLayer}
                disabled={hiddenLayers.length <= 1}
                className={`rounded-md border px-4 py-3 text-sm font-semibold transition ${
                  hiddenLayers.length > 1
                    ? 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700'
                    : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                }`}
              >
                층 제거
              </button>
            </div>
            {hiddenLayers.length <= 1 && (
              <p className="text-sm font-semibold text-slate-500">
                최소 1개의 은닉층은 필요합니다.
              </p>
            )}
          </div>
        </PlaceholderCard>

        <PlaceholderCard title="3. 학습 설정">
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <label>
                <span className="text-sm font-semibold text-slate-700">학습률</span>
                <input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={learningRate}
                  onChange={(event) => setLearningRate(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-700">배치 크기</span>
                <input
                  type="number"
                  min="1"
                  value={batchSize}
                  onChange={(event) => setBatchSize(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-700">손실 함수</span>
                <select className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                  <option>MSE</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <label className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-sm font-semibold text-slate-700">정규화 (L2)</span>
                <input
                  type="checkbox"
                  checked={l2Regularization}
                  onChange={(event) => setL2Regularization(event.target.checked)}
                  className="h-5 w-5 accent-blue-600"
                />
              </label>
              <label className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-sm font-semibold text-slate-700">조기 종료</span>
                <input
                  type="checkbox"
                  checked={earlyStopping}
                  onChange={(event) => setEarlyStopping(event.target.checked)}
                  className="h-5 w-5 accent-blue-600"
                />
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-700">조기 종료 기준</span>
                <select
                  value={earlyStoppingCriterion}
                  onChange={(event) => setEarlyStoppingCriterion(event.target.value as EarlyStoppingCriterion)}
                  className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  {earlyStoppingCriteria.map((criterion) => (
                    <option key={criterion}>{criterion}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-[1fr_1fr] gap-3">
              <button
                type="button"
                onClick={runTraining}
                disabled={!canTrain}
                className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-bold text-white transition ${
                  canTrain ? 'bg-blue-600 hover:bg-blue-700' : 'cursor-not-allowed bg-slate-300'
                }`}
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                신경망 학습 실행
              </button>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold text-slate-500">학습 상태</p>
                <p className="mt-1 text-base font-bold text-slate-900">{trainingStatus}</p>
                {trainingProgress.epoch > 0 && (
                  <p className="mt-1 text-xs font-semibold text-slate-600">
                    현재 epoch: {trainingProgress.epoch} · 현재 loss: {formatMetric(trainingProgress.loss)}
                  </p>
                )}
              </div>
            </div>

            {trainingError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {trainingError}
              </p>
            )}
          </div>
        </PlaceholderCard>

        <PlaceholderCard title="4. 후보 항 입력 및 LASSO 설정">
          <div className="mt-5 grid grid-cols-[minmax(0,1.25fr)_280px] gap-4">
            <div className="space-y-4">
              <div className="rounded-md border border-slate-200 bg-white p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-700">후보 항 (직접 입력)</p>
                  <button
                    type="button"
                    onClick={addTerm}
                    className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    항 추가
                  </button>
                </div>
                <div className="flex flex-wrap items-start gap-3">
                  <span className="pt-3 text-xl font-bold text-blue-700">â_NN ≈</span>
                  {terms.map((term, index) => (
                    <div key={`distill-term-${index}`} className="flex items-start gap-2">
                      {index > 0 && <span className="pt-3 text-lg font-bold text-slate-400">+</span>}
                      <div>
                        <label className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
                          termErrors[index] ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'
                        }`}>
                          <span className="text-sm font-bold text-slate-700">c{index}</span>
                          <input
                            type="text"
                            value={term}
                            onChange={(event) => updateTerm(index, event.target.value)}
                            placeholder="항 입력"
                            className={`w-24 rounded-md border bg-white px-3 py-2 text-center text-sm font-semibold outline-none focus:ring-2 ${
                              termErrors[index]
                                ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                : 'border-slate-200 focus:border-blue-400 focus:ring-blue-100'
                            }`}
                          />
                        </label>
                        {termErrors[index] && (
                          <p className="mt-1 max-w-44 text-xs font-semibold text-red-600">{termErrors[index]}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteTerm(index)}
                        aria-label={`${index + 1}번째 후보 항 삭제`}
                        title="항 삭제"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-600">현재 후보 모델:</p>
                <p className="mt-2 break-words text-base font-bold text-slate-900">
                  {buildCandidatePreview(terms)}
                </p>
              </div>
              <p className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
                예시: 1, x, v, x^2, v^2, x*v, abs(v)*v, sin(x)
              </p>
              <p className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
                신경망을 먼저 학습한 뒤, NN 예측값 â_NN을 목표로 Lasso를 수행하여 해석 가능한 식을 추출합니다.
              </p>
              <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-700">
                추출된 식은 진짜 물리 법칙이라기보다, 신경망의 예측 행동을 설명하는 근사식입니다.
              </p>
              {hasInvalidTerms && (
                <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  올바르지 않은 후보 항이 있습니다.
                </p>
              )}
            </div>

            <div className="space-y-4 rounded-md border border-slate-200 bg-slate-50 p-4">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-700">LASSO 정규화 강도 λ</span>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={lambda}
                    onChange={(event) => setLambda(event.target.value)}
                    className="w-24 rounded-md border border-slate-200 bg-white px-3 py-2 text-right text-sm font-semibold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <input
                  type="range"
                  min="0.001"
                  max="10"
                  step="0.001"
                  value={lambda}
                  onChange={(event) => setLambda(event.target.value)}
                  className="mt-3 w-full accent-blue-600"
                />
                <div className="mt-1 flex justify-between text-xs font-semibold text-slate-500">
                  <span>0.001</span>
                  <span>10</span>
                </div>
              </div>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={standardizeTerms}
                  onChange={(event) => setStandardizeTerms(event.target.checked)}
                  className="h-5 w-5 accent-blue-600"
                />
                <span className="text-sm font-semibold text-slate-700">후보 항 자동 표준화</span>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">검증 방식</span>
                <select
                  value={validationMode}
                  onChange={(event) => setValidationMode(event.target.value as LassoValidationMode)}
                  className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  {validationModes.map((mode) => (
                    <option key={mode}>{mode}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={runDistillation}
                disabled={!canDistill}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-bold text-white transition ${
                  canDistill ? 'bg-blue-600 hover:bg-blue-700' : 'cursor-not-allowed bg-slate-300'
                }`}
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                식 추출 실행
              </button>
              {!trainingResult && (
                <p className="text-xs font-semibold leading-5 text-slate-500">
                  신경망 학습 완료 후 식 추출을 실행할 수 있습니다.
                </p>
              )}
            </div>
          </div>
        </PlaceholderCard>

        <PlaceholderCard title="5. 추정 결과">
          <div className="mt-5 space-y-4">
            {distillationError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {distillationError}
              </p>
            )}
            <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-sm font-semibold text-blue-700">추출된 가속도 식</p>
              <p className="mt-2 break-words text-xl font-bold text-blue-900">
                {distillationResult?.extractedFormula ?? '식 추출 결과가 여기에 표시됩니다.'}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold text-slate-500">NN 학습 오차 (MSE)</p>
                <p className="mt-1 text-lg font-bold text-slate-900">
                  {trainingResult ? formatMetric(trainingResult.mse) : '-'}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold text-slate-500">증류 오차 (MSE)</p>
                <p className="mt-1 text-lg font-bold text-slate-900">
                  {distillationResult ? formatMetric(distillationResult.distillationMse) : '-'}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold text-slate-500">선택된 항 수</p>
                <p className="mt-1 text-lg font-bold text-slate-900">
                  {distillationLassoResult ? `${distillationLassoResult.selectedTermCount}개` : '-'}
                </p>
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-bold text-slate-800">제거된 항 (0으로 축소)</p>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                {distillationLassoResult
                  ? distillationLassoResult.removedTerms.join(', ') || '제거된 항 없음'
                  : '식 추출 후 표시됩니다.'}
              </p>
            </div>
            {distillationLassoResult && (
              <div className="max-h-56 overflow-auto rounded-md border border-slate-200">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 bg-slate-100 text-slate-700">
                    <tr>
                      {['계수', '항', '계수 값', '상태'].map((header) => (
                        <th key={header} className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {distillationLassoResult.coefficients.map((coefficient, index) => (
                      <tr key={`distill-coef-${index}`} className="odd:bg-white even:bg-slate-50">
                        <td className="border-b border-slate-100 px-3 py-2 font-semibold text-slate-700">c{index}</td>
                        <td className="border-b border-slate-100 px-3 py-2 font-medium text-slate-700">{coefficient.term}</td>
                        <td className="border-b border-slate-100 px-3 py-2 font-semibold text-blue-700">{formatLassoCoefficient(coefficient.coefficient)}</td>
                        <td className="border-b border-slate-100 px-3 py-2">
                          <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                            coefficient.status === '선택됨'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-slate-200 text-slate-600'
                          }`}>
                            {coefficient.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </PlaceholderCard>

        <PlaceholderCard title="NN 예측 vs 데이터">
          <PredictionComparisonChart
            dataset={selectedDataset}
            targets={trainingResult?.targets ?? []}
            predictions={trainingResult?.predictions ?? []}
          />
        </PlaceholderCard>

        <PlaceholderCard title="λ에 따른 검증 오차">
          <ValidationErrorChart result={distillationLassoResult} />
        </PlaceholderCard>

        <PlaceholderCard title="계수 크기">
          <CoefficientMagnitudeChart result={distillationLassoResult} />
        </PlaceholderCard>
      </div>
    </main>
  );
}
