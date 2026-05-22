import { getAxisOption } from '../constants/axisOptions';
import type { AxisKey } from '../types/axis';
import type { DatasetRow } from '../types/dataset';
import { computeNiceAxisDomain, formatTick } from '../utils/niceAxis';

type LineChartProps = {
  rows: DatasetRow[];
  xAxis: AxisKey;
  yAxis: AxisKey;
};

const chart = {
  width: 640,
  height: 380,
  paddingTop: 34,
  paddingRight: 34,
  paddingBottom: 60,
  paddingLeft: 72,
};

export function LineChart({ rows, xAxis, yAxis }: LineChartProps) {
  const xOption = getAxisOption(xAxis);
  const yOption = getAxisOption(yAxis);
  const plotWidth = chart.width - chart.paddingLeft - chart.paddingRight;
  const plotHeight = chart.height - chart.paddingTop - chart.paddingBottom;

  if (rows.length === 0) {
    return (
      <div className="flex h-[340px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-500">
        표시할 데이터가 없습니다.
      </div>
    );
  }

  const xValues = rows.map((row) => row[xAxis]);
  const yValues = rows.map((row) => row[yAxis]);
  const xDomain = computeNiceAxisDomain(xValues, { targetTickCount: 6 });
  const yDomain = computeNiceAxisDomain(yValues, { targetTickCount: 6 });

  const scaleX = (value: number) =>
    chart.paddingLeft + ((value - xDomain.min) / (xDomain.max - xDomain.min)) * plotWidth;
  const scaleY = (value: number) =>
    chart.paddingTop + plotHeight - ((value - yDomain.min) / (yDomain.max - yDomain.min)) * plotHeight;

  return (
    <div className="mt-5 rounded-md border border-slate-200 bg-white p-3">
      <svg
        role="img"
        aria-label={`${xOption.label}와 ${yOption.label} 그래프`}
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        className="h-[340px] w-full"
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
            <g key={`x-${tick}`}>
              <line
                x1={x}
                y1={chart.paddingTop}
                x2={x}
                y2={chart.paddingTop + plotHeight}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text x={x} y={chart.height - 24} textAnchor="middle" className="fill-slate-500 text-[12px]">
                {formatTick(tick)}
              </text>
            </g>
          );
        })}

        {yDomain.ticks.map((tick) => {
          const y = scaleY(tick);

          return (
            <g key={`y-${tick}`}>
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

        {rows.map((row, index) => (
          <circle
            key={`${row[xAxis]}-${row[yAxis]}-${index}`}
            cx={scaleX(row[xAxis])}
            cy={scaleY(row[yAxis])}
            r="2"
            fill="#2563eb"
            opacity="0.72"
          />
        ))}

        <text
          x={chart.paddingLeft + plotWidth / 2}
          y={chart.height - 4}
          textAnchor="middle"
          className="fill-slate-700 text-[15px] font-bold"
        >
          {xOption.label} ({xOption.unit})
        </text>
        <text
          x={18}
          y={chart.paddingTop + plotHeight / 2}
          textAnchor="middle"
          transform={`rotate(-90 18 ${chart.paddingTop + plotHeight / 2})`}
          className="fill-slate-700 text-[15px] font-bold"
        >
          {yOption.label} ({yOption.unit})
        </text>
      </svg>
    </div>
  );
}
