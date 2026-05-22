import { Play, RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { GraphCard } from '../components/GraphCard';
import { PlaceholderCard } from '../components/PlaceholderCard';
import type { AxisKey } from '../types/axis';
import type { MotionDataset, RawMotionDataset } from '../types/dataset';
import {
  buildProcessedDataset,
  defaultDerivativeSettings,
  type DerivativeMethod,
  type DerivativeSettings,
} from '../utils/derivatives';

type DataAnalysisPageProps = {
  sourceDataset: RawMotionDataset;
  processedDataset: MotionDataset;
  onProcessedDatasetChange: (dataset: MotionDataset) => void;
};

type GraphConfig = {
  title: string;
  xAxis: AxisKey;
  yAxis: AxisKey;
};

const methodOptions: DerivativeMethod[] = ['전처리 하지 않기', 'Savitzky-Golay 필터 + 미분'];
const initialGraphConfigs: GraphConfig[] = [
  { title: '그래프 1', xAxis: 't', yAxis: 'x' },
  { title: '그래프 2', xAxis: 't', yAxis: 'v' },
  { title: '그래프 3', xAxis: 't', yAxis: 'a' },
];

function formatCalculationTime() {
  return new Date().toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function DataAnalysisPage({
  sourceDataset,
  processedDataset,
  onProcessedDatasetChange,
}: DataAnalysisPageProps) {
  const [settings, setSettings] = useState<DerivativeSettings>(defaultDerivativeSettings);
  const [graphConfigs, setGraphConfigs] = useState(initialGraphConfigs);
  const [calculationStatus, setCalculationStatus] = useState('초기 계산 완료');

  useEffect(() => {
    const nextSettings = { ...defaultDerivativeSettings };

    setSettings(nextSettings);
    onProcessedDatasetChange(buildProcessedDataset(sourceDataset, nextSettings));
    setCalculationStatus('초기 계산 완료');
  }, [onProcessedDatasetChange, sourceDataset]);

  const runCalculation = (nextSettings = settings) => {
    onProcessedDatasetChange(buildProcessedDataset(sourceDataset, nextSettings));
    setCalculationStatus(`최근 계산: ${formatCalculationTime()}`);
  };

  const updateSettings = (patch: Partial<DerivativeSettings>) => {
    const nextSettings = { ...settings, ...patch };

    setSettings(nextSettings);
    setCalculationStatus('설정이 변경되었습니다. 계산 실행을 눌러 결과를 갱신하세요.');
  };

  const updateGraphAxis = (index: number, axisType: 'xAxis' | 'yAxis', axis: AxisKey) => {
    setGraphConfigs((currentConfigs) =>
      currentConfigs.map((config, configIndex) =>
        configIndex === index ? { ...config, [axisType]: axis } : config,
      ),
    );
  };

  return (
    <main className="mx-auto max-w-[1800px] space-y-5 px-6 py-5">
      <PlaceholderCard title="1. 파생 변수 계산 설정">
        <div className="mt-5 grid grid-cols-1 items-end gap-4 xl:grid-cols-[minmax(260px,1fr)_minmax(260px,1.2fr)_140px_140px_160px]">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-600">
              위치 데이터 x(t)로부터 속도 v(t)와 가속도 a(t)를 계산합니다.
            </p>
            <p className="text-sm font-semibold text-blue-700">
              속도 v(t)와 가속도 a(t)는 항상 계산됩니다.
            </p>
            <p className="text-xs font-semibold text-slate-500">
              미분 끝점 경계 효과를 줄이기 위해 양끝 일부 점은 자동 제외됩니다.
            </p>
          </div>

          <label>
            <span className="text-sm font-semibold text-slate-700">계산 방법</span>
            <select
              value={settings.method}
              onChange={(event) => updateSettings({ method: event.target.value as DerivativeMethod })}
              className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              {methodOptions.map((method) => (
                <option key={method}>{method}</option>
              ))}
            </select>
          </label>

          <label className={settings.method === 'Savitzky-Golay 필터 + 미분' ? '' : 'opacity-50'}>
            <span className="text-sm font-semibold text-slate-700">창 길이</span>
            <input
              type="number"
              min="3"
              step="2"
              disabled={settings.method !== 'Savitzky-Golay 필터 + 미분'}
              value={settings.windowLength}
              onChange={(event) => updateSettings({ windowLength: Number(event.target.value) })}
              className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className={settings.method === 'Savitzky-Golay 필터 + 미분' ? '' : 'opacity-50'}>
            <span className="text-sm font-semibold text-slate-700">다항식 차수</span>
            <input
              type="number"
              min="1"
              max="5"
              disabled={settings.method !== 'Savitzky-Golay 필터 + 미분'}
              value={settings.polynomialOrder}
              onChange={(event) => updateSettings({ polynomialOrder: Number(event.target.value) })}
              className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => runCalculation()}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              계산 실행
            </button>
            <button
              type="button"
              onClick={() => runCalculation()}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              다시 계산
            </button>
            <p className="text-center text-xs font-semibold text-slate-500">
              {calculationStatus}
            </p>
          </div>
        </div>
      </PlaceholderCard>

      <PlaceholderCard title="2. 계산 결과 그래프">
        <p className="mt-2 text-sm font-semibold text-slate-500">
          그래프의 X축과 Y축을 선택하여 다양한 관계를 확인하세요.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
          {graphConfigs.map((config, index) => (
            <GraphCard
              key={config.title}
              title={config.title}
              dataset={processedDataset}
              xAxis={config.xAxis}
              yAxis={config.yAxis}
              onXAxisChange={(axis) => updateGraphAxis(index, 'xAxis', axis)}
              onYAxisChange={(axis) => updateGraphAxis(index, 'yAxis', axis)}
            />
          ))}
        </div>
      </PlaceholderCard>
    </main>
  );
}
