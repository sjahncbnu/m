import type { AppView } from '../types/navigation';

type ViewTabsProps = {
  currentView: AppView;
  onChange: (view: AppView) => void;
};

const tabs: Array<{ id: AppView; label: string }> = [
  { id: 'basic', label: '기본 분석' },
  { id: 'lasso', label: 'Lasso 회귀' },
];

export function ViewTabs({ currentView, onChange }: ViewTabsProps) {
  return (
    <nav className="border-b border-slate-200 bg-white" aria-label="보기 선택">
      <div className="mx-auto flex max-w-[1800px] gap-2 px-6">
        {tabs.map((tab) => {
          const isActive = tab.id === currentView;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`border-b-2 px-4 py-4 text-sm font-semibold transition ${
                isActive
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
