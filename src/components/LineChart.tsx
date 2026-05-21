import { getAxisOption } from '../constants/axisOptions';
import type { AxisKey } from '../types/axis';
import type { DatasetRow } from '../types/dataset';

type LineChartProps = {
  rows: DatasetRow[];
  xAxis: AxisKey;
  yAxis: AxisKey;
};

const chart = {
  width: 640,
  height: 300,
  paddingTop: 26,
  paddingRight: 28,
  paddingBottom: 48,
  paddingLeft: 58,
};

function formatNumber(value: number) {
  if (Math.abs(value) >= 100) {
    return value.toFixed(0);
  }

  if (Math.abs(value) >= 10) {
    return value.toFixed(1);
  }

  return value.toFixed(2).replace(/\.?0+$/, '');
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

function getTicks(min: number, max: number) {
  return Array.from({ length: 5 }, (_, index) => min + ((max - min) * index) / 4);
}

export function LineChart({ rows, xAxis, yAxis }: LineChartProps) {
  const xOption = getAxisOption(xAxis);
  const yOption = getAxisOption(yAxis);
  const plotWidth = chart.width - chart.paddingLeft - chart.paddingRight;
  const plotHeight = chart.height - chart.paddingTop - chart.paddingBottom;

  if (rows.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-500">
        표시할 데이터가 없습니다.
      </div>
    );
  }

  const xValues = rows.map((row) => row[xAxis]);
  const yValues = rows.map((row) => row[yAxis]);
  const [xMin, xMax] = getDomain(xValues);
  const [yMin, yMax] = getDomain(yValues);
  const xTicks = getTicks(xMin, xMax);
  const yTicks = getTicks(yMin, yMax);

  const scaleX = (value: number) =>
    chart.paddingLeft + ((value - xMin) / (xMax - xMin)) * plotWidth;
  const scaleY = (value: number) =>
    chart.paddingTop + plotHeight - ((value - yMin) / (yMax - yMin)) * plotHeight;

  const points = rows.map((row) => `${scaleX(row[xAxis])},${scaleY(row[yAxis])}`).join(' ');

  return (
    <div className="mt-5 rounded-md border border-slate-200 bg-white p-3">
      <svg
        role="img"
        aria-label={`${xOption.label}와 ${yOption.label} 그래프`}
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        className="h-64 w-full"
      >
        <rect
          x={chart.paddingLeft}
          y={chart.paddingTop}
          width={plotWidth}
          height={plotHeight}
          fill="#f8fafc"
          rx="6"
        />

        {xTicks.map((tick) => {
          const x = scaleX(tick);

          return (
            <g key={`x-${tick}`}>
              <line
                x1={x}
                y1={chart.paddingTop}
                x2={x}
                y2={chart.paddingTop + plotHeight}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
              />
              <text x={x} y={chart.height - 22} textAnchor="middle" className="fill-slate-500 text-[12px]">
                {formatNumber(tick)}
              </text>
            </g>
          );
        })}

        {yTicks.map((tick) => {
          const y = scaleY(tick);

          return (
            <g key={`y-${tick}`}>
              <line
                x1={chart.paddingLeft}
                y1={y}
                x2={chart.paddingLeft + plotWidth}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
              />
              <text x={chart.paddingLeft - 12} y={y + 4} textAnchor="end" className="fill-slate-500 text-[12px]">
                {formatNumber(tick)}
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

        <polyline fill="none" stroke="#2563eb" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" points={points} />
        {rows.map((row, index) => (
          <circle
            key={`${row[xAxis]}-${row[yAxis]}-${index}`}
            cx={scaleX(row[xAxis])}
            cy={scaleY(row[yAxis])}
            r="3.5"
            fill="#2563eb"
          />
        ))}

        <text
          x={chart.paddingLeft + plotWidth / 2}
          y={chart.height - 4}
          textAnchor="middle"
          className="fill-slate-700 text-[13px] font-semibold"
        >
          {xOption.label} ({xOption.unit})
        </text>
        <text
          x={18}
          y={chart.paddingTop + plotHeight / 2}
          textAnchor="middle"
          transform={`rotate(-90 18 ${chart.paddingTop + plotHeight / 2})`}
          className="fill-slate-700 text-[13px] font-semibold"
        >
          {yOption.label} ({yOption.unit})
        </text>
      </svg>
    </div>
  );
}
