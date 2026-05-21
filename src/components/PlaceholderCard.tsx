import type { ReactNode } from 'react';

type PlaceholderCardProps = {
  title: string;
  children?: ReactNode;
  className?: string;
};

export function PlaceholderCard({ title, children, className = '' }: PlaceholderCardProps) {
  return (
    <section
      className={`rounded-lg border border-slate-200 bg-white p-5 shadow-card ${className}`}
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      </div>
      {children ?? (
        <div className="mt-5 flex min-h-40 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-sm font-medium text-slate-500">
          준비 중
        </div>
      )}
    </section>
  );
}
