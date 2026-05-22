import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { FitComparisonChart } from '../components/charts/FitComparisonChart';
import { PlaceholderCard } from '../components/PlaceholderCard';
import type { MotionDataset } from '../types/dataset';
import type { LassoWorkerRequest, LassoWorkerResponse } from '../types/lassoWorker';
import { buildFeatureMatrix, parseTerm } from '../utils/formula';
import {
  formatLassoCoefficient,
  fitLassoAnalysis,
  type LassoAnalysisResult,
  type LassoValidationMode,
  type LassoValidationPoint,
} from '../utils/lasso';
import { hasAccelerationValues } from '../utils/ols';

type LassoPageProps = {
  selectedDataset: MotionDataset;
  onBackToData: () => void;
};

const defaultCandidateTerms: string[] = [];
const validationModes: LassoValidationMode[] = ['전체 데이터 사용', '5-fold 교차검증'];

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
    return 'a ≈ 항 없음';
  }

  return `a ≈ ${terms
    .map((term, index) => `c${index}·${term.trim() || '(빈 항)'}`)
    .join(' + ')}`;
}

function formatMetric(value: number) {
  if (!Number.isFinite(value)) {
    return '-';
  }

  if (value !== 0 && (Math.abs(value) >= 1000 || Math.abs(value) < 0.001)) {
    return value.toExponential(3);
  }

  return value.toFixed(4);
}

function buildSelectedAccelerationModel(result: LassoAnalysisResult) {
  const selectedPieces = result.coefficients
    .filter((coefficient) => coefficient.status === '선택됨')
    .map(
      (coefficient) =>
        `${formatLassoCoefficient(coefficient.coefficient)}·${coefficient.term}`,
    );

  if (Math.abs(result.interceptOffset) >= 1e-6) {
    selectedPieces.unshift(`절편 ${formatLassoCoefficient(result.interceptOffset)}`);
  }

  return selectedPieces.length > 0 ? `a ≈ ${selectedPieces.join(' + ')}` : 'a ≈ 0';
}

function getPointCoordinate(
  point: LassoValidationPoint,
  minLogLambda: number,
  maxLogLambda: number,
  maxMse: number,
) {
  const xRange = maxLogLambda - minLogLambda || 1;
  const x = 44 + ((Math.log10(Math.max(point.lambda, 1e-12)) - minLogLambda) / xRange) * 416;
  const y = 164 - (point.validationMse / maxMse) * 116;

  return { x, y };
}

function LambdaValidationChart({
  points,
  optimalLambda,
}: {
  points: LassoValidationPoint[];
  optimalLambda: number;
}) {
  const validPoints = points.filter(
    (point) =>
      Number.isFinite(point.lambda) &&
      point.lambda >= 0 &&
      Number.isFinite(point.validationMse),
  );

  if (validPoints.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
        표시할 검증 오차가 없습니다.
      </div>
    );
  }

  const logs = validPoints.map((point) => Math.log10(Math.max(point.lambda, 1e-12)));
  const minLogLambda = Math.min(...logs);
  const maxLogLambda = Math.max(...logs);
  const maxMse = Math.max(...validPoints.map((point) => point.validationMse), 1e-9);
  const coordinates = validPoints.map((point) =>
    getPointCoordinate(point, minLogLambda, maxLogLambda, maxMse),
  );
  const optimalPoint = validPoints.find((point) => point.lambda === optimalLambda);
  const optimalX = optimalPoint
    ? getPointCoordinate(optimalPoint, minLogLambda, maxLogLambda, maxMse).x
    : null;

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-bold text-slate-900">λ에 따른 검증 오차</p>
        <p className="text-xs font-semibold text-slate-500">검증 MSE</p>
      </div>
      <svg
        viewBox="0 0 504 210"
        role="img"
        aria-label="λ에 따른 검증 오차"
        className="mt-3 h-56 w-full"
      >
        {[0, 1, 2, 3].map((tick) => {
          const y = 164 - (tick / 3) * 116;
          return (
            <g key={`mse-grid-${tick}`}>
              <line x1="44" x2="460" y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
              <text x="36" y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">
                {formatMetric((maxMse * tick) / 3)}
              </text>
            </g>
          );
        })}
        <line x1="44" x2="460" y1="164" y2="164" stroke="#cbd5e1" />
        <line x1="44" x2="44" y1="48" y2="164" stroke="#cbd5e1" />
        {coordinates.length > 1 && (
          <polyline
            points={coordinates.map((point) => `${point.x},${point.y}`).join(' ')}
            fill="none"
            stroke="#2563eb"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {optimalX !== null && (
          <line x1={optimalX} x2={optimalX} y1="48" y2="164" stroke="#2563eb" strokeDasharray="5 5" />
        )}
        {coordinates.map((point, index) => (
          <circle
            key={`lambda-point-${validPoints[index].lambda}`}
            cx={point.x}
            cy={point.y}
            r={validPoints[index].lambda === optimalLambda ? 5 : 3.5}
            fill={validPoints[index].lambda === optimalLambda ? '#1d4ed8' : '#60a5fa'}
          />
        ))}
        <text x="252" y="198" textAnchor="middle" fontSize="12" fontWeight="700" fill="#475569">
          λ
        </text>
        <text x="44" y="184" textAnchor="middle" fontSize="11" fill="#64748b">
          {validPoints[0].lambda.toPrecision(3)}
        </text>
        <text x="460" y="184" textAnchor="middle" fontSize="11" fill="#64748b">
          {validPoints[validPoints.length - 1].lambda.toPrecision(3)}
        </text>
      </svg>
    </div>
  );
}

function CoefficientMagnitudeChart({ result }: { result: LassoAnalysisResult }) {
  const maxMagnitude = Math.max(
    ...result.coefficients.map((coefficient) => Math.abs(coefficient.coefficient)),
    1e-9,
  );

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <p className="text-base font-bold text-slate-900">계수 크기</p>
      <div className="mt-3 space-y-2">
        {result.coefficients.map((coefficient) => (
          <div key={`size-${coefficient.term}`}>
            <div className="flex justify-between gap-3 text-xs font-semibold text-slate-600">
              <span>{coefficient.term}</span>
              <span>{formatLassoCoefficient(coefficient.coefficient)}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{
                  width: `${(Math.abs(coefficient.coefficient) / maxMagnitude) * 100}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LassoPage({ selectedDataset, onBackToData }: LassoPageProps) {
  const [candidateTerms, setCandidateTerms] = useState(defaultCandidateTerms);
  const [lambda, setLambda] = useState('0.12');
  const [autoLambda, setAutoLambda] = useState(false);
  const [standardizeTerms, setStandardizeTerms] = useState(true);
  const [validationMode, setValidationMode] =
    useState<LassoValidationMode>('5-fold 교차검증');
  const [fitResult, setFitResult] = useState<LassoAnalysisResult | null>(null);
  const [fitError, setFitError] = useState<string | null>(null);
  const [isFitting, setIsFitting] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const termErrors = getTermErrors(candidateTerms, selectedDataset);
  const hasInvalidTerms = termErrors.some(Boolean);
  const parsedLambda = Number(lambda);
  const hasAcceleration = hasAccelerationValues(selectedDataset);
  const isLambdaValid =
    autoLambda || (lambda.trim() !== '' && Number.isFinite(parsedLambda) && parsedLambda >= 0);
  const canRunLasso =
    candidateTerms.length > 0 &&
    !hasInvalidTerms &&
    hasAcceleration &&
    isLambdaValid &&
    selectedDataset.rows.length > 0 &&
    !isFitting;

  useEffect(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setFitResult(null);
    setFitError(null);
    setIsFitting(false);
  }, [selectedDataset.id, candidateTerms, lambda, autoLambda, standardizeTerms, validationMode]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
    },
    [],
  );

  const updateCandidateTerm = (index: number, value: string) => {
    setCandidateTerms((currentTerms) =>
      currentTerms.map((term, termIndex) => (termIndex === index ? value : term)),
    );
  };

  const addCandidateTerm = () => {
    setCandidateTerms((currentTerms) => [...currentTerms, '']);
  };

  const deleteCandidateTerm = (index: number) => {
    setCandidateTerms((currentTerms) =>
      currentTerms.filter((_, termIndex) => termIndex !== index),
    );
  };

  const handleLambdaChange = (value: string) => {
    const numberValue = Number(value);

    if (Number.isFinite(numberValue)) {
      setLambda(String(numberValue));
    }
  };

  const runLassoFit = () => {
    if (!canRunLasso) {
      return;
    }

    const requestId = `lasso-${Date.now()}-${requestIdRef.current}`;
    requestIdRef.current += 1;
    const request: LassoWorkerRequest = {
      id: requestId,
      terms: candidateTerms,
      dataset: selectedDataset,
      lambda: autoLambda ? parsedLambda || 0.12 : parsedLambda,
      standardize: standardizeTerms,
      autoSearch: autoLambda,
      validationMode,
    };

    setFitError(null);
    setFitResult(null);
    setIsFitting(true);
    workerRef.current?.terminate();

    try {
      const worker = new Worker(new URL('../workers/lassoWorker.ts', import.meta.url), {
        type: 'module',
      });

      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent<LassoWorkerResponse>) => {
        if (event.data.id !== requestId) {
          return;
        }

        if (event.data.ok) {
          setFitResult(event.data.result);
        } else {
          setFitError(event.data.error);
        }

        setIsFitting(false);
        worker.terminate();
        workerRef.current = null;
      };
      worker.onerror = () => {
        setFitResult(null);
        setFitError('Lasso 계산 워커를 실행하는 중 문제가 발생했습니다.');
        setIsFitting(false);
        worker.terminate();
        workerRef.current = null;
      };
      worker.postMessage(request);
    } catch {
      try {
        setFitResult(
          fitLassoAnalysis(candidateTerms, selectedDataset, {
            lambda: request.lambda,
            standardize: standardizeTerms,
            autoSearch: autoLambda,
            validationMode,
          }),
        );
      } catch (fallbackError) {
        setFitResult(null);
        setFitError(
          fallbackError instanceof Error
            ? fallbackError.message
            : 'Lasso 피팅 중 알 수 없는 문제가 발생했습니다.',
        );
      } finally {
        setIsFitting(false);
      }
    }
  };

  return (
    <main className="mx-auto max-w-[1800px] px-6 py-5">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-950">Lasso 피팅</h2>
        <button
          type="button"
          onClick={onBackToData}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-card transition hover:border-blue-200 hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          데이터 분석으로 돌아가기
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <PlaceholderCard title="데이터 및 목표값">
          <div className="mt-5 space-y-4">
            <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-sm font-semibold text-blue-800">
                선택된 데이터셋: {selectedDataset.name}
              </p>
              <p className="mt-1 text-sm font-medium text-blue-700">
                데이터 행 수: 총 {selectedDataset.rows.length}개 행
              </p>
            </div>

            <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-base font-semibold text-blue-800">
              목표값: 가속도 a
            </div>

            <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold">
                      t
                    </th>
                    <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold">
                      x
                    </th>
                    <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold">
                      v
                    </th>
                    <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold">
                      a
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDataset.rows.slice(0, 5).map((row, index) => (
                    <tr key={`${selectedDataset.id}-lasso-preview-${index}`} className="odd:bg-white even:bg-slate-50">
                      <td className="border-b border-slate-100 px-3 py-2 text-right font-medium text-slate-700">
                        {row.t}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 text-right font-medium text-slate-700">
                        {row.x}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 text-right font-medium text-slate-700">
                        {row.v}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 text-right font-medium text-slate-700">
                        {row.a}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </PlaceholderCard>

        <PlaceholderCard title="후보 항 입력">
          <div className="mt-5 space-y-4">
            <div className="rounded-md border border-slate-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-slate-700">기저 항 후보</p>
                <button
                  type="button"
                  onClick={addCandidateTerm}
                  className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />항 추가
                </button>
              </div>

              <div className="flex flex-wrap items-start gap-3">
                <span className="pt-3 text-xl font-bold text-blue-700">a ≈</span>
                {candidateTerms.length === 0 ? (
                  <span className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
                    입력된 후보 항이 없습니다.
                  </span>
                ) : (
                  candidateTerms.map((term, index) => (
                    <div key={`lasso-term-${index}`} className="flex items-start gap-2">
                      {index > 0 && <span className="pt-3 text-lg font-bold text-slate-400">+</span>}
                      <div>
                        <label
                          className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
                            termErrors[index]
                              ? 'border-red-200 bg-red-50'
                              : 'border-slate-200 bg-slate-50'
                          }`}
                        >
                          <span className="text-sm font-bold text-slate-700">c{index}</span>
                          <input
                            type="text"
                            value={term}
                            onChange={(event) => updateCandidateTerm(index, event.target.value)}
                            placeholder="항 입력"
                            aria-invalid={Boolean(termErrors[index])}
                            className={`w-28 rounded-md border bg-white px-3 py-2 text-center text-base font-semibold text-slate-900 outline-none transition focus:ring-2 ${
                              termErrors[index]
                                ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                : 'border-slate-200 focus:border-blue-400 focus:ring-blue-100'
                            }`}
                          />
                        </label>
                        {termErrors[index] && (
                          <p className="mt-1 max-w-44 text-xs font-semibold text-red-600">
                            {termErrors[index]}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteCandidateTerm(index)}
                        aria-label={`${index + 1}번째 후보 항 삭제`}
                        title="항 삭제"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {hasInvalidTerms && (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  올바르지 않은 후보 항이 있습니다.
                </div>
              )}

              {!hasAcceleration && (
                <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                  가속도 a 값이 없어 목표값을 만들 수 없습니다.
                </div>
              )}
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-600">현재 후보 모델:</p>
              <p className="mt-2 break-words text-base font-bold text-slate-900">
                {buildCandidatePreview(candidateTerms)}
              </p>
            </div>

            <p className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
              예시: 1, x, v, x^2, v^2, x*v, abs(v)*v, sign(v), sin(x)
            </p>
          </div>
        </PlaceholderCard>

        <PlaceholderCard title="Lasso 설정">
          <div className="mt-5 space-y-5">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">모델 선택</span>
              <select
                value="Lasso 피팅"
                onChange={() => undefined}
                className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option>Lasso 피팅</option>
              </select>
            </label>

            <div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-700">λ</span>
                <input
                  type="number"
                  min="0.001"
                  max="10"
                  step="0.001"
                  value={lambda}
                  onChange={(event) => handleLambdaChange(event.target.value)}
                  disabled={autoLambda}
                  className="w-28 rounded-md border border-slate-200 bg-white px-3 py-2 text-right text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
              <input
                type="range"
                min="0.001"
                max="10"
                step="0.001"
                value={lambda}
                onChange={(event) => handleLambdaChange(event.target.value)}
                disabled={autoLambda}
                className="mt-3 w-full accent-blue-600 disabled:opacity-50"
              />
              <div className="mt-1 flex justify-between text-xs font-semibold text-slate-500">
                <span>0.001</span>
                <span>10</span>
              </div>
            </div>

            <label className="flex items-center justify-between gap-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-sm font-semibold text-slate-700">λ 자동 탐색</span>
              <input
                type="checkbox"
                checked={autoLambda}
                onChange={(event) => setAutoLambda(event.target.checked)}
                className="h-5 w-5 accent-blue-600"
              />
            </label>

            <label className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <input
                type="checkbox"
                checked={standardizeTerms}
                onChange={(event) => setStandardizeTerms(event.target.checked)}
                className="h-5 w-5 accent-blue-600"
              />
              <span className="text-sm font-semibold text-slate-700">
                후보 항 자동 표준화
              </span>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">검증 방식</span>
              <select
                value={validationMode}
                onChange={(event) =>
                  setValidationMode(event.target.value as LassoValidationMode)
                }
                className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                {validationModes.map((mode) => (
                  <option key={mode}>{mode}</option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={runLassoFit}
              disabled={!canRunLasso}
              className={`w-full rounded-md px-4 py-3 text-sm font-bold text-white transition ${
                canRunLasso
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'cursor-not-allowed bg-slate-300 text-slate-100'
              }`}
            >
              {isFitting ? 'Lasso 피팅 중...' : 'Lasso 피팅 실행'}
            </button>

            {!isLambdaValid && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                λ 값은 0 이상의 숫자로 입력해야 합니다.
              </p>
            )}

            {autoLambda && (
              <p className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
                λ 자동 탐색이 켜져 있어 로그 간격 후보 중 검증 MSE가 가장 낮은 λ를 선택합니다.
              </p>
            )}
          </div>
        </PlaceholderCard>

        <PlaceholderCard title="학습 결과" className="col-span-3">
          <div className="mt-5 space-y-4">
            {fitError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {fitError}
              </div>
            )}

            {!fitResult && !fitError && (
              <div className="grid grid-cols-5 gap-4">
                {['선택된 가속도 모델', '추정된 계수', '제거된 항', '검증 오차', '계수 크기'].map(
                  (title) => (
                    <div
                      key={title}
                      className="flex h-44 flex-col justify-between rounded-md border border-dashed border-slate-300 bg-slate-50 p-4"
                    >
                      <p className="text-base font-bold text-slate-800">{title}</p>
                      <p className="text-sm font-semibold text-slate-500">결과 영역</p>
                    </div>
                  ),
                )}
              </div>
            )}

            {fitResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-[1.05fr_1.35fr_1fr] gap-4">
                  <div className="rounded-md border border-blue-100 bg-blue-50 p-4">
                    <p className="text-base font-bold text-blue-900">선택된 가속도 모델</p>
                    <p className="mt-3 break-words text-lg font-bold text-blue-800">
                      {buildSelectedAccelerationModel(fitResult)}
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-md border border-blue-100 bg-white/70 p-3">
                        <p className="text-xs font-semibold text-blue-600">최적 λ</p>
                        <p className="mt-1 text-lg font-bold text-blue-900">
                          {formatMetric(fitResult.optimalLambda)}
                        </p>
                      </div>
                      <div className="rounded-md border border-blue-100 bg-white/70 p-3">
                        <p className="text-xs font-semibold text-blue-600">검증 MSE</p>
                        <p className="mt-1 text-lg font-bold text-blue-900">
                          {formatMetric(fitResult.validationMse)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-blue-700">
                      선택된 항 수: {fitResult.selectedTermCount}개
                    </p>
                    <p className="mt-1 text-sm font-semibold text-blue-700">
                      검증 방식: {fitResult.validationMode}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-blue-700">
                      선택된 항:{' '}
                      {fitResult.selectedTerms.length > 0
                        ? fitResult.selectedTerms.join(', ')
                        : '없음'}
                    </p>
                  </div>

                  <div className="rounded-md border border-slate-200 bg-white p-4">
                    <p className="text-base font-bold text-slate-900">추정된 계수</p>
                    <div className="mt-3 max-h-72 overflow-auto rounded-md border border-slate-200">
                      <table className="w-full border-collapse text-sm">
                        <thead className="sticky top-0 bg-slate-100 text-slate-700">
                          <tr>
                            <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                              계수
                            </th>
                            <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                              항
                            </th>
                            <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold">
                              계수 값
                            </th>
                            <th className="border-b border-slate-200 px-3 py-2 text-center font-semibold">
                              상태
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {fitResult.coefficients.map((coefficient, index) => (
                            <tr
                              key={`${coefficient.term}-${index}`}
                              className="odd:bg-white even:bg-slate-50"
                            >
                              <td className="border-b border-slate-100 px-3 py-2 font-semibold text-slate-700">
                                c{index}
                              </td>
                              <td className="border-b border-slate-100 px-3 py-2 font-medium text-slate-700">
                                {coefficient.term}
                              </td>
                              <td className="border-b border-slate-100 px-3 py-2 text-right font-semibold text-blue-700">
                                {formatLassoCoefficient(coefficient.coefficient)}
                              </td>
                              <td className="border-b border-slate-100 px-3 py-2 text-center">
                                <span
                                  className={`rounded-full px-2 py-1 text-xs font-bold ${
                                    coefficient.status === '선택됨'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-slate-200 text-slate-600'
                                  }`}
                                >
                                  {coefficient.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                      <p className="text-base font-bold text-slate-900">검증 오차</p>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="rounded-md border border-slate-200 bg-white p-3">
                          <p className="text-xs font-semibold text-slate-500">R²</p>
                          <p className="mt-1 text-xl font-bold text-slate-900">
                            {fitResult.rSquared.toFixed(4)}
                          </p>
                        </div>
                        <div className="rounded-md border border-slate-200 bg-white p-3">
                          <p className="text-xs font-semibold text-slate-500">MAE</p>
                          <p className="mt-1 text-xl font-bold text-slate-900">
                            {fitResult.mae.toFixed(4)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                      <p className="text-base font-bold text-slate-900">제거된 항</p>
                      <p className="mt-2 text-sm font-semibold text-slate-600">
                        {fitResult.removedTerms.length > 0
                          ? fitResult.removedTerms.join(', ')
                          : '제거된 항 없음'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-[1.35fr_1fr] gap-4">
                  <LambdaValidationChart
                    points={fitResult.validationCurve}
                    optimalLambda={fitResult.optimalLambda}
                  />
                  <CoefficientMagnitudeChart result={fitResult} />
                </div>

                <FitComparisonChart
                  rows={selectedDataset.rows}
                  predictions={fitResult.predictions}
                />
              </div>
            )}
          </div>
        </PlaceholderCard>
      </div>
    </main>
  );
}
