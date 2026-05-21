import type { MotionDataset } from '../types/dataset';

const acceleration = 9.8;

export const demoDataset: MotionDataset = {
  id: 'demo-constant-acceleration',
  name: '데모 데이터셋',
  rows: Array.from({ length: 9 }, (_, index) => {
    const t = Number((index * 0.1).toFixed(1));

    return {
      t,
      x: Number((0.5 * acceleration * t * t).toFixed(3)),
      v: Number((acceleration * t).toFixed(3)),
      a: acceleration,
    };
  }),
};
