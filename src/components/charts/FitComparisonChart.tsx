import type { DatasetRow } from '../../types/dataset';
import { computeNiceAxisDomain, formatTick } from '../../utils/niceAxis';

type FitComparisonChartProps = {
  rows: DatasetRow[];
  predictions: number[];
  actualLabel?: string;
  predictionLabel?: string;
};

const chart = {
  width: 860,
  height: 360,
  paddingTop: 42,
  paddingRight: 34,
  paddingBottom: 62,
  paddingLeft: 78,
};

function buildPolyline(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
}

function getSampleStep(length: number) {
  return Math.max(1, Math.ceil(length / 260));
}

export function FitComparisonChart({
  rows,
  predictions,
  actualLabel = '실제 a',
  predictionLabel = '예측 â',
}: FitComparisonChartProps) {
  const plotWidth = chart.width - chart.paddingLeft - chart.paddingRight;
  const plotHeight = chart.height - chart.paddingTop - chart.paddingBottom;
  const pairedRows = rows
    .map((row, index) => ({ row, prediction: predictions[index] }))
    .filter(({ row, prediction }) => Number.isFinite(row.t) && Number.isFinite(row.a) && Number.isFinite(prediction));

  if (pairedRows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
        비교할 피팅 결과가 없습니다.
      </div>
    );
  }

  const xDomain = computeNiceAxisDomain(
    pairedRows.map(({ row }) => row.t),
    { targetTickCount: 7 },
  );
  const yDomain = computeNiceAxisDomain(
    pairedRows.flatMap(({ row, prediction }) => [row.a, prediction]),
    { targetTickCount: 6 },
  );
  const scaleX = (value: number) =>
    chart.paddingLeft + ((value - xDomain.min) / (xDomain.max - xDomain.min)) * plotWidth;
  const scaleY = (value: number) =>
    chart.paddingTop + plotHeight - ((value - yDomain.min) / (yDomain.max - yDomain.min)) * plotHeight;

  const actualPoints = pairedRows.map(({ row }) => ({
    x: scaleX(row.t),
    y: scaleY(row.a),
  }));
  const predictionPoints = pairedRows.map(({ row, prediction }) => ({
    x: scaleX(row.t),
    y: scaleY(prediction),
  }));
  const sampleStep = getSampleStep(pairedRows.length);

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-slate-900">피팅 결과 비교</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            피팅된 모델이 계산한 예측 가속도 â와 데이터에서 얻은 가속도 a를 비교합니다.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
            {actualLabel}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
            {predictionLabel}
          </span>
        </div>
      </div>

      <svg
        role="img"
        aria-label="실제 가속도와 예측 가속도 비교"
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        className="mt-4 h-[340px] w-full"
      >
        <rect
          x={chart.paddingLeft}
          y={chart.paddingTop}
          width={plotWidth}
          height={plotHeight}
          fill="#f8fafc"
          rx="6"
        />

        {xDomain.ticks.map((tick) => {
          const x = scaleX(tick);

          return (
            <g key={`fit-x-${tick}`}>
              <line
                x1={x}
                y1={chart.paddingTop}
                x2={x}
                y2={chart.paddingTop + plotHeight}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text x={x} y={chart.height - 26} textAnchor="middle" className="fill-slate-500 text-[12px]">
                {formatTick(tick)}
              </text>
            </g>
          );
        })}

        {yDomain.ticks.map((tick) => {
          const y = scaleY(tick);

          return (
            <g key={`fit-y-${tick}`}>
              <line
                x1={chart.paddingLeft}
                y1={y}
                x2={chart.paddingLeft + plotWidth}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text x={chart.paddingLeft - 12} y={y + 4} textAnchor="end" className="fill-slate-500 text-[12px]">
                {formatTick(tick)}
              </text>
            </g>
          );
        })}

        <line
          x1={chart.paddingLeft}
          y1={chart.paddingTop + plotHeight}
          x2={chart.paddingLeft + plotWidth}
          y2={chart.paddingTop + plotHeight}
          stroke="#94a3b8"
          strokeWidth="1.5"
        />
        <line
          x1={chart.paddingLeft}
          y1={chart.paddingTop}
          x2={chart.paddingLeft}
          y2={chart.paddingTop + plotHeight}
          stroke="#94a3b8"
          strokeWidth="1.5"
        />

        {actualPoints.length > 1 && (
          <polyline
            points={buildPolyline(actualPoints)}
            fill="none"
            stroke="#2563eb"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.8"
          />
        )}
        {predictionPoints.length > 1 && (
          <polyline
            points={buildPolyline(predictionPoints)}
            fill="none"
            stroke="#f97316"
            strokeWidth="2.2"
            strokeDasharray="7 5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
          />
        )}

        {pairedRows.map(({ row }, index) =>
          index % sampleStep === 0 || index === pairedRows.length - 1 ? (
            <circle
              key={`actual-point-${index}`}
              cx={scaleX(row.t)}
              cy={scaleY(row.a)}
              r="2.2"
              fill="#2563eb"
              opacity="0.62"
            />
          ) : null,
        )}
        {pairedRows.map(({ row, prediction }, index) =>
          index % sampleStep === 0 || index === pairedRows.length - 1 ? (
            <circle
              key={`prediction-point-${index}`}
              cx={scaleX(row.t)}
              cy={scaleY(prediction)}
              r="2.2"
              fill="#f97316"
              opacity="0.7"
            />
          ) : null,
        )}

        <text
          x={chart.paddingLeft + plotWidth / 2}
          y={chart.height - 5}
          textAnchor="middle"
          className="fill-slate-700 text-[15px] font-bold"
        >
          시간 t (s)
        </text>
        <text
          x={20}
          y={chart.paddingTop + plotHeight / 2}
          textAnchor="middle"
          transform={`rotate(-90 20 ${chart.paddingTop + plotHeight / 2})`}
          className="fill-slate-700 text-[15px] font-bold"
        >
          가속도 a (m/s²)
        </text>
      </svg>
    </div>
  );
}
