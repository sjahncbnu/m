import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { MotionDataset } from '../types/dataset';
import { buildFeatureMatrix, parseTerm } from '../utils/formula';
import {
  fitOrdinaryLeastSquares,
  hasAccelerationValues,
  type OlsFitResult,
} from '../utils/ols';

const defaultTerms = ['1', 'x', 'v', 'v^2', 'x*v'];

function buildModelPreview(terms: string[]) {
  const visibleTerms = terms.map((term) => term.trim() || '(빈 항)');

  if (visibleTerms.length === 0) {
    return 'F_net = 항 없음';
  }

  return `F_net = ${visibleTerms
    .map((term, index) => `c${index}·${term}`)
    .join(' + ')}`;
}

function formatCoefficient(value: number) {
  if (Math.abs(value) < 1e-10) {
    return '0.0000';
  }

  return value.toFixed(4);
}

function buildFittedModel(terms: string[], coefficients: number[]) {
  return `F_net = ${coefficients
    .map((coefficient, index) => `${formatCoefficient(coefficient)}·${terms[index].trim()}`)
    .join(' + ')}`;
}

type NetForcePanelProps = {
  dataset: MotionDataset;
};

export function NetForcePanel({ dataset }: NetForcePanelProps) {
  const [mass, setMass] = useState('1.00');
  const [terms, setTerms] = useState(defaultTerms);
  const [fitResult, setFitResult] = useState<OlsFitResult | null>(null);
  const [fitError, setFitError] = useState<string | null>(null);
  const termErrors = terms.map((term) => {
    try {
      parseTerm(term);
      buildFeatureMatrix([term], dataset);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : '항을 해석할 수 없습니다.';
    }
  });
  const hasInvalidTerms = termErrors.some(Boolean);
  const parsedMass = Number(mass);
  const isMassValid = mass.trim() !== '' && Number.isFinite(parsedMass);
  const hasAcceleration = hasAccelerationValues(dataset);
  const canFit =
    terms.length > 0 && !hasInvalidTerms && isMassValid && hasAcceleration && dataset.rows.length > 0;

  useEffect(() => {
    setFitResult(null);
    setFitError(null);
  }, [dataset.id, mass, terms]);

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

  const runFit = () => {
    try {
      setFitError(null);
      setFitResult(fitOrdinaryLeastSquares(terms, dataset, parsedMass));
    } catch (error) {
      setFitResult(null);
      setFitError(
        error instanceof Error
          ? error.message
          : '모델 피팅 중 알 수 없는 문제가 발생했습니다.',
      );
    }
  };

  return (
    <div className="mt-5 space-y-5">
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <label className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <span className="block text-sm font-semibold text-slate-700">질량 m (kg)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={mass}
            onChange={(event) => setMass(event.target.value)}
            className="mt-3 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <div className="flex items-center rounded-md border border-blue-100 bg-blue-50 px-4 py-4 text-base font-semibold text-blue-800">
          목표값: F_net = m · a
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-slate-700">기저 항 입력</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={addTerm}
              className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />항 추가
            </button>
            <button
              type="button"
              onClick={runFit}
              disabled={!canFit}
              className={`rounded-md px-4 py-2 text-sm font-semibold text-white transition ${
                canFit
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'cursor-not-allowed bg-slate-300 text-slate-100'
              }`}
            >
              모델 피팅
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-3">
          <span className="text-xl font-bold text-blue-700">F_net =</span>
          {terms.length === 0 ? (
            <span className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
              입력된 항이 없습니다.
            </span>
          ) : (
            terms.map((term, index) => (
              <div key={`term-${index}`} className="flex items-start gap-2">
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
                      onChange={(event) => updateTerm(index, event.target.value)}
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
                  onClick={() => deleteTerm(index)}
                  aria-label={`${index + 1}번째 항 삭제`}
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
            올바르지 않은 항이 있습니다. 지원 변수는 t, x, v, a이며 지원 함수는 abs, sin,
            cos, exp, log, sqrt입니다. 현재 데이터셋에서 계산 가능한 항만 사용할 수 있습니다.
          </div>
        )}

        {!hasAcceleration && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            가속도 a 값이 없어 목표값 F_net = m · a를 만들 수 없습니다.
          </div>
        )}

        {!isMassValid && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            질량 m은 숫자로 입력해야 합니다.
          </div>
        )}
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-4">
        <p className="text-sm font-semibold text-slate-600">현재 모델:</p>
        <p className="mt-2 break-words text-lg font-bold text-slate-900">
          {buildModelPreview(terms)}
        </p>
        <p className="mt-2 text-sm font-medium text-slate-500">
          계수 c0, c1, c2, ...는 이후 단계에서 추정됩니다.
        </p>
      </div>

      {fitError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-4 text-sm font-semibold text-red-700">
          {fitError}
        </div>
      )}

      {fitResult && (
        <div className="rounded-md border border-blue-100 bg-white px-4 py-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div>
              <p className="text-sm font-semibold text-slate-600">추정된 모델</p>
              <p className="mt-2 break-words text-lg font-bold text-blue-800">
                {buildFittedModel(terms, fitResult.coefficients)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">R²</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {fitResult.rSquared.toFixed(4)}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">MAE</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {fitResult.mae.toFixed(4)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    계수
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    항
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold">
                    추정값
                  </th>
                </tr>
              </thead>
              <tbody>
                {fitResult.coefficients.map((coefficient, index) => (
                  <tr key={`coefficient-${index}`} className="odd:bg-white even:bg-slate-50">
                    <td className="border-b border-slate-100 px-3 py-2 font-semibold text-slate-700">
                      c{index}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 font-medium text-slate-700">
                      {terms[index].trim()}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-right font-semibold text-blue-700">
                      {formatCoefficient(coefficient)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
