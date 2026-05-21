import { axisOptions } from '../constants/axisOptions';
import { LineChart } from './LineChart';
import type { AxisKey } from '../types/axis';
import type { MotionDataset } from '../types/dataset';

type GraphCardProps = {
  title: string;
  dataset: MotionDataset;
  xAxis: AxisKey;
  yAxis: AxisKey;
  onXAxisChange: (axis: AxisKey) => void;
  onYAxisChange: (axis: AxisKey) => void;
};

export function GraphCard({
  title,
  dataset,
  xAxis,
  yAxis,
  onXAxisChange,
  onYAxisChange,
}: GraphCardProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            x축
            <select
              value={xAxis}
              onChange={(event) => onXAxisChange(event.target.value as AxisKey)}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              {axisOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            y축
            <select
              value={yAxis}
              onChange={(event) => onYAxisChange(event.target.value as AxisKey)}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              {axisOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <LineChart rows={dataset.rows} xAxis={xAxis} yAxis={yAxis} />
    </section>
  );
}
