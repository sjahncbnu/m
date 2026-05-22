import type { DatasetRow } from './dataset';

export type AxisKey = Extract<keyof DatasetRow, 't' | 'x' | 'v' | 'a'>;

export type AxisOption = {
  key: AxisKey;
  label: string;
  unit: string;
};
