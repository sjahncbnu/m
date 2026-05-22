import { NetForcePanel } from '../components/NetForcePanel';
import { PlaceholderCard } from '../components/PlaceholderCard';
import type { MotionDataset } from '../types/dataset';

type BasicFittingPageProps = {
  dataset: MotionDataset;
};

function formatNumber(value: number) {
  if (!Number.isFinite(value)) {
    return '-';
  }

  return value.toFixed(3).replace(/\.?0+$/, '');
}

export function BasicFittingPage({ dataset }: BasicFittingPageProps) {
  const times = dataset.rows.map((row) => row.t);
  const minTime = times.length > 0 ? Math.min(...times) : 0;
  const maxTime = times.length > 0 ? Math.max(...times) : 0;

  return (
    <main className="mx-auto grid max-w-[1800px] grid-cols-[360px_minmax(0,1fr)] gap-4 px-6 py-5">
      <PlaceholderCard title="1. 데이터 및 목표값">
        <div className="mt-5 space-y-4">
          <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
            <p>선택된 데이터셋: {dataset.name}</p>
            <p className="mt-1">
              데이터 포인트: {dataset.rows.length}개 · 시간 범위: {formatNumber(minTime)} ~{' '}
              {formatNumber(maxTime)} s
            </p>
          </div>
          <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-base font-semibold text-blue-800">
            목표값: 가속도 a
          </div>
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
                {dataset.rows.slice(0, 8).map((row, index) => (
                  <tr key={`basic-fit-preview-${index}`} className="odd:bg-white even:bg-slate-50">
                    <td className="border-b border-slate-100 px-3 py-2 text-right font-medium text-slate-700">
                      {formatNumber(row.t)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-right font-medium text-slate-700">
                      {formatNumber(row.x)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-right font-medium text-slate-700">
                      {formatNumber(row.v)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-right font-medium text-slate-700">
                      {formatNumber(row.a)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
            이 데이터는 데이터 분석 탭에서 전처리된 데이터입니다.
          </p>
        </div>
      </PlaceholderCard>

      <PlaceholderCard title="2. 후보 항 입력 및 기본 피팅">
        <NetForcePanel dataset={dataset} />
      </PlaceholderCard>
    </main>
  );
}
