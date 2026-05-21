import { useState } from 'react';
import { ViewTabs } from './components/ViewTabs';
import { demoDataset } from './data/demoDataset';
import { AppHeader } from './layout/AppHeader';
import { BasicAnalysisPage } from './pages/BasicAnalysisPage';
import { LassoPage } from './pages/LassoPage';
import { parseMotionCsv } from './utils/csv';
import type { AppView } from './types/navigation';
import type { MotionDataset } from './types/dataset';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('basic');
  const [datasets, setDatasets] = useState<MotionDataset[]>([demoDataset]);
  const [selectedDatasetId, setSelectedDatasetId] = useState(demoDataset.id);
  const [datasetMessage, setDatasetMessage] = useState<string | null>(null);

  const selectedDataset =
    datasets.find((dataset) => dataset.id === selectedDatasetId) ?? demoDataset;

  const handleCsvImport = async (file: File) => {
    try {
      const csvText = await file.text();
      const importedDataset = parseMotionCsv(csvText, file.name.replace(/\.csv$/i, ''));

      setDatasets((currentDatasets) => [...currentDatasets, importedDataset]);
      setSelectedDatasetId(importedDataset.id);
      setDatasetMessage(`${importedDataset.name} 데이터를 불러왔습니다.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CSV 파일을 읽을 수 없습니다.';
      setDatasetMessage(message);
    }
  };

  const handleReset = () => {
    setDatasets([demoDataset]);
    setSelectedDatasetId(demoDataset.id);
    setDatasetMessage('데이터셋을 초기 상태로 되돌렸습니다.');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader
        datasets={datasets}
        selectedDatasetId={selectedDataset.id}
        onDatasetChange={setSelectedDatasetId}
        onCsvImport={handleCsvImport}
        onReset={handleReset}
      />
      {datasetMessage && (
        <div className="border-b border-blue-100 bg-blue-50 px-6 py-3 text-sm font-semibold text-blue-800">
          <div className="mx-auto max-w-[1800px]">{datasetMessage}</div>
        </div>
      )}
      <ViewTabs currentView={currentView} onChange={setCurrentView} />
      {currentView === 'basic' ? (
        <BasicAnalysisPage selectedDataset={selectedDataset} />
      ) : (
        <LassoPage
          selectedDataset={selectedDataset}
          onBackToBasic={() => setCurrentView('basic')}
        />
      )}
    </div>
  );
}
