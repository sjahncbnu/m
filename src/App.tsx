import { useState } from 'react';
import { ViewTabs } from './components/ViewTabs';
import { builtInDatasets, demoDataset } from './data/demoDataset';
import { AppHeader } from './layout/AppHeader';
import { BasicFittingPage } from './pages/BasicFittingPage';
import { DataAnalysisPage } from './pages/DataAnalysisPage';
import { LassoPage } from './pages/LassoPage';
import { NeuralNetworkPage } from './pages/NeuralNetworkPage';
import type { AppView } from './types/navigation';
import { buildProcessedDataset, defaultDerivativeSettings } from './utils/derivatives';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('data');
  const [datasets] = useState(builtInDatasets);
  const [selectedDatasetId, setSelectedDatasetId] = useState(demoDataset.id);
  const [processedDataset, setProcessedDataset] = useState(() =>
    buildProcessedDataset(demoDataset, defaultDerivativeSettings),
  );

  const selectedDataset =
    datasets.find((dataset) => dataset.id === selectedDatasetId) ?? demoDataset;

  const handleDatasetChange = (datasetId: string) => {
    const nextDataset = datasets.find((dataset) => dataset.id === datasetId) ?? demoDataset;

    setSelectedDatasetId(nextDataset.id);
    setProcessedDataset(buildProcessedDataset(nextDataset, defaultDerivativeSettings));
  };

  const handleReset = () => {
    setSelectedDatasetId(demoDataset.id);
    setProcessedDataset(buildProcessedDataset(demoDataset, defaultDerivativeSettings));
    setCurrentView('data');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader
        datasets={datasets}
        selectedDatasetId={selectedDataset.id}
        onDatasetChange={handleDatasetChange}
        onReset={handleReset}
      />
      <ViewTabs currentView={currentView} onChange={setCurrentView} />
      <div className={currentView === 'data' ? 'block' : 'hidden'}>
        <DataAnalysisPage
          sourceDataset={selectedDataset}
          processedDataset={processedDataset}
          onProcessedDatasetChange={setProcessedDataset}
        />
      </div>
      <div className={currentView === 'basicFit' ? 'block' : 'hidden'}>
        <BasicFittingPage dataset={processedDataset} />
      </div>
      <div className={currentView === 'lasso' ? 'block' : 'hidden'}>
        <LassoPage
          selectedDataset={processedDataset}
          onBackToData={() => setCurrentView('data')}
        />
      </div>
      <div className={currentView === 'neural' ? 'block' : 'hidden'}>
        <NeuralNetworkPage selectedDataset={processedDataset} />
      </div>
    </div>
  );
}
