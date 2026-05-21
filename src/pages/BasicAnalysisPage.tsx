import { useState } from 'react';
import { GraphCard } from '../components/GraphCard';
import { NetForcePanel } from '../components/NetForcePanel';
import { PlaceholderCard } from '../components/PlaceholderCard';
import type { AxisKey } from '../types/axis';
import type { MotionDataset } from '../types/dataset';

type GraphConfig = {
  title: string;
  xAxis: AxisKey;
  yAxis: AxisKey;
};

const initialGraphConfigs: GraphConfig[] = [
  { title: '그래프 1', xAxis: 't', yAxis: 'x' },
  { title: '그래프 2', xAxis: 't', yAxis: 'v' },
  { title: '그래프 3', xAxis: 'v', yAxis: 'x' },
  { title: '그래프 4', xAxis: 'x', yAxis: 't' },
];

type BasicAnalysisPageProps = {
  selectedDataset: MotionDataset;
};

export function BasicAnalysisPage({ selectedDataset }: BasicAnalysisPageProps) {
  const [graphConfigs, setGraphConfigs] = useState(initialGraphConfigs);

  const updateGraphAxis = (index: number, axisType: 'xAxis' | 'yAxis', axis: AxisKey) => {
    setGraphConfigs((currentConfigs) =>
      currentConfigs.map((config, configIndex) =>
        configIndex === index ? { ...config, [axisType]: axis } : config,
      ),
    );
  };

  return (
    <main className="mx-auto grid max-w-[1800px] grid-cols-[minmax(0,1fr)_360px] gap-4 px-6 py-5">
      <div className="grid grid-cols-2 gap-4">
        {graphConfigs.map((config, index) => (
          <GraphCard
            key={config.title}
            title={config.title}
            dataset={selectedDataset}
            xAxis={config.xAxis}
            yAxis={config.yAxis}
            onXAxisChange={(axis) => updateGraphAxis(index, 'xAxis', axis)}
            onYAxisChange={(axis) => updateGraphAxis(index, 'yAxis', axis)}
          />
        ))}
      </div>

      <PlaceholderCard title="데이터 테이블" className="row-span-1">
        <div className="mt-5 overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
            현재 데이터셋: {selectedDataset.name}
          </div>
          <div className="h-[540px] overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-100 text-slate-700">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-3 text-right font-semibold">
                    t (s)
                  </th>
                  <th className="border-b border-slate-200 px-3 py-3 text-right font-semibold">
                    x (m)
                  </th>
                  <th className="border-b border-slate-200 px-3 py-3 text-right font-semibold">
                    v (m/s)
                  </th>
                  <th className="border-b border-slate-200 px-3 py-3 text-right font-semibold">
                    a (m/s²)
                  </th>
                </tr>
              </thead>
              <tbody>
                {selectedDataset.rows.map((row, index) => (
                  <tr
                    key={`${selectedDataset.id}-${index}`}
                    className="odd:bg-white even:bg-slate-50"
                  >
                    <td className="border-b border-slate-100 px-3 py-3 text-right font-medium text-slate-700">
                      {row.t}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-right font-medium text-slate-700">
                      {row.x}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-right font-medium text-slate-700">
                      {row.v}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-right font-medium text-slate-700">
                      {row.a}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-200 bg-slate-50 px-3 py-3 text-center text-xs font-semibold text-slate-500">
            총 {selectedDataset.rows.length}개 행
          </div>
        </div>
      </PlaceholderCard>

      <PlaceholderCard title="알짜힘 추정" className="col-span-2">
        <NetForcePanel dataset={selectedDataset} />
      </PlaceholderCard>
    </main>
  );
}
