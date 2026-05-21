import { Atom, MoreVertical, RotateCcw, Upload } from 'lucide-react';
import { useRef } from 'react';
import type { MotionDataset } from '../types/dataset';

type AppHeaderProps = {
  datasets: MotionDataset[];
  selectedDatasetId: string;
  onDatasetChange: (datasetId: string) => void;
  onCsvImport: (file: File) => void;
  onReset: () => void;
};

export function AppHeader({
  datasets,
  selectedDatasetId,
  onDatasetChange,
  onCsvImport,
  onReset,
}: AppHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCsvButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      onCsvImport(file);
    }

    event.target.value = '';
  };

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-6 px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600">
            <Atom className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="truncate text-2xl font-bold text-slate-950">
            운동 분석 시뮬레이터
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <label className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
            <span className="border-r border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
              데이터셋 선택
            </span>
            <select
              value={selectedDatasetId}
              onChange={(event) => onDatasetChange(event.target.value)}
              className="min-w-40 appearance-none bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none"
            >
              {datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={handleCsvButtonClick}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-card transition hover:border-blue-200 hover:text-blue-700"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            데이터 불러오기
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-card transition hover:border-blue-200 hover:text-blue-700"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            초기화
          </button>

          <button
            type="button"
            aria-label="추가 메뉴"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-card transition hover:border-blue-200 hover:text-blue-700"
          >
            <MoreVertical className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
