export type DatasetRow = {
  t: number;
  x: number;
  v: number;
  a: number;
};

export type MotionDataset = {
  id: string;
  name: string;
  rows: DatasetRow[];
};
