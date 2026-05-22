import type { MotionDataset } from '../types/dataset';
import { formatLassoCoefficient, type LassoAnalysisResult } from '../utils/lasso';

const chart = {
  width: 640,
  height: 260,
  left: 58,
  right: 24,
  top: 26,
  bottom: 44,
};

function formatNumber(value: number) {
  if (!Number.isFinite(value)) {
    return '-';
  }

  if (value !== 0 && (Math.abs(value) >= 1000 || Math.abs(value) < 0.001)) {
    return value.toExponential(2);
  }

  return value.toFixed(3).replace(/\.?0+$/, '');
}

function getDomain(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    const margin = Math.abs(min) > 0 ? Math.abs(min) * 0.1 : 1;
    return [min - margin, max + margin] as const;
  }

  const margin = (max - min) * 0.08;
  return [min - margin, max + margin] as const;
}

function ticks(min: number, max: number) {
  return Array.from({ length: 4 }, (_, index) => min + ((max - min) * index) / 3);
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="mt-4 flex h-64 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-500">
      {message}
    </div>
  );
}

export function PredictionComparisonChart({
  dataset,
  targets,
  predictions,
}: {
  dataset: MotionDataset;
  targets: number[];
  predictions: number[];
}) {
  if (targets.length === 0 || predictions.length === 0) {
    return <EmptyChart message="신경망 학습 후 예측 그래프가 표시됩니다." />;
  }

  const plotWidth = chart.width - chart.left - chart.right;
  const plotHeight = chart.height - chart.top - chart.bottom;
  const xValues = dataset.rows.map((row, index) =>
    Number.isFinite(row.t) ? row.t : index,
  );
  const [xMin, xMax] = getDomain(xValues);
  const [yMin, yMax] = getDomain([...targets, ...predictions]);
  const scaleX = (value: number) => chart.left + ((value - xMin) / (xMax - xMin)) * plotWidth;
  const scaleY = (value: number) =>
    chart.top + plotHeight - ((value - yMin) / (yMax - yMin)) * plotHeight;
  const actualPoints = targets
    .map((target, index) => `${scaleX(xValues[index])},${scaleY(target)}`)
    .join(' ');
  const predictionPoints = predictions
    .map((prediction, index) => `${scaleX(xValues[index])},${scaleY(prediction)}`)
    .join(' ');

  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-white p-3">
      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        role="img"
        aria-label="NN 예측과 실제 데이터 비교 그래프"
        className="h-64 w-full"
      >
        <rect
          x={chart.left}
          y={chart.top}
          width={plotWidth}
          height={plotHeight}
          rx="6"
          fill="#f8fafc"
        />
        {ticks(xMin, xMax).map((tick) => {
          const x = scaleX(tick);
          return (
            <g key={`x-${tick}`}>
              <line x1={x} x2={x} y1={chart.top} y2={chart.top + plotHeight} stroke="#e2e8f0" strokeDasharray="4 4" />
              <text x={x} y={chart.height - 18} textAnchor="middle" className="fill-slate-500 text-[11px]">
                {formatNumber(tick)}
              </text>
            </g>
          );
        })}
        {ticks(yMin, yMax).map((tick) => {
          const y = scaleY(tick);
          return (
            <g key={`y-${tick}`}>
              <line x1={chart.left} x2={chart.left + plotWidth} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
              <text x={chart.left - 10} y={y + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
                {formatNumber(tick)}
              </text>
            </g>
          );
        })}
        <polyline fill="none" stroke="#2563eb" strokeWidth="3" points={actualPoints} />
        <polyline fill="none" stroke="#f97316" strokeWidth="3" strokeDasharray="6 5" points={predictionPoints} />
        <text x={chart.left + plotWidth / 2} y={chart.height - 2} textAnchor="middle" className="fill-slate-700 text-[12px] font-semibold">
          t (s)
        </text>
        <text x="18" y={chart.top + plotHeight / 2} textAnchor="middle" transform={`rotate(-90 18 ${chart.top + plotHeight / 2})`} className="fill-slate-700 text-[12px] font-semibold">
          a (m/s²)
        </text>
      </svg>
      <div className="mt-2 flex justify-center gap-6 text-xs font-semibold text-slate-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-1 w-8 rounded bg-blue-600" />
          측정 가속도 a
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-1 w-8 rounded bg-orange-500" />
          NN 예측 â_NN
        </span>
      </div>
    </div>
  );
}

export function ValidationErrorChart({ result }: { result: LassoAnalysisResult | null }) {
  if (!result || result.validationCurve.length === 0) {
    return <EmptyChart message="식 추출 실행 후 검증 오차가 표시됩니다." />;
  }

  const plotWidth = chart.width - chart.left - chart.right;
  const plotHeight = chart.height - chart.top - chart.bottom;
  const values = result.validationCurve.filter((point) => Number.isFinite(point.validationMse));
  const xLogs = values.map((point) => Math.log10(Math.max(point.lambda, 1e-12)));
  const [xMin, xMax] = getDomain(xLogs);
  const [yMin, yMax] = getDomain(values.map((point) => point.validationMse));
  const scaleX = (lambda: number) =>
    chart.left + ((Math.log10(Math.max(lambda, 1e-12)) - xMin) / (xMax - xMin)) * plotWidth;
  const scaleY = (value: number) =>
    chart.top + plotHeight - ((value - yMin) / (yMax - yMin)) * plotHeight;
  const points = values
    .map((point) => `${scaleX(point.lambda)},${scaleY(point.validationMse)}`)
    .join(' ');
  const optimalX = scaleX(result.optimalLambda);

  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-white p-3">
      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        role="img"
        aria-label="λ에 따른 검증 오차 그래프"
        className="h-64 w-full"
      >
        <rect x={chart.left} y={chart.top} width={plotWidth} height={plotHeight} rx="6" fill="#f8fafc" />
        {ticks(yMin, yMax).map((tick) => {
          const y = scaleY(tick);
          return (
            <g key={`mse-${tick}`}>
              <line x1={chart.left} x2={chart.left + plotWidth} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
              <text x={chart.left - 10} y={y + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
                {formatNumber(tick)}
              </text>
            </g>
          );
        })}
        <polyline fill="none" stroke="#2563eb" strokeWidth="3" points={points} />
        <line x1={optimalX} x2={optimalX} y1={chart.top} y2={chart.top + plotHeight} stroke="#2563eb" strokeDasharray="5 5" />
        {values.map((point) => (
          <circle key={`lambda-${point.lambda}`} cx={scaleX(point.lambda)} cy={scaleY(point.validationMse)} r="4" fill="#2563eb" />
        ))}
        <text x={chart.left + plotWidth / 2} y={chart.height - 2} textAnchor="middle" className="fill-slate-700 text-[12px] font-semibold">
          λ
        </text>
        <text x={chart.width - 70} y="22" className="fill-blue-700 text-[12px] font-bold">
          최적 λ = {formatNumber(result.optimalLambda)}
        </text>
      </svg>
    </div>
  );
}

export function CoefficientMagnitudeChart({ result }: { result: LassoAnalysisResult | null }) {
  if (!result) {
    return <EmptyChart message="식 추출 실행 후 계수 크기가 표시됩니다." />;
  }

  const maxMagnitude = Math.max(
    ...result.coefficients.map((coefficient) => Math.abs(coefficient.coefficient)),
    1e-9,
  );

  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-white p-4">
      <div className="space-y-3">
        {result.coefficients.map((coefficient, index) => {
          const magnitude = Math.abs(coefficient.coefficient);

          return (
            <div key={`coef-${coefficient.term}-${index}`}>
              <div className="flex justify-between gap-3 text-xs font-semibold text-slate-600">
                <span>
                  {coefficient.term} (c{index})
                </span>
                <span>{formatLassoCoefficient(coefficient.coefficient)}</span>
              </div>
              <div className="mt-1 h-3 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full ${
                    coefficient.status === '선택됨' ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                  style={{ width: `${(magnitude / maxMagnitude) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
