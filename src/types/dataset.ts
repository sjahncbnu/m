export type DatasetRow = {
  t: number;
  x: number;
  v: number;
  a: number;
};

export type RawDatasetRow = Pick<DatasetRow, 't' | 'x'>;

export type RawMotionDataset = {
  id: string;
  name: string;
  description: string;
  motionType:
    | 'free-fall'
    | 'free-fall-noisy'
    | 'uniform'
    | 'constant-acceleration'
    | 'spring'
    | 'constant-acceleration-noisy'
    | 'medium-noise-free-fall'
    | 'damped-spring'
    | 'nonlinear-spring'
    | 'damped-nonlinear-spring'
    | 'air-resistance-fall'
    | 'driven-damped-oscillation'
    | 'large-angle-pendulum'
    | 'friction-sliding'
    | 'piecewise-force';
  difficulty?: number;
  trueLaw?: string;
  recommendedTerms?: string[];
  noiseLevel?: 'none' | 'weak' | 'medium';
  units: {
    t: 's';
    x: 'm';
  };
  rawColumns: ['t', 'x'];
  rawRows: RawDatasetRow[];
};

export type MotionDataset = {
  id: string;
  name: string;
  rows: DatasetRow[];
  sourceId?: string;
  sourceName?: string;
  rawRows?: RawDatasetRow[];
};
