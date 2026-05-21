import type { MotionDataset } from './dataset';
import type { LassoAnalysisResult, LassoValidationMode } from '../utils/lasso';

export type LassoWorkerRequest = {
  id: string;
  terms: string[];
  dataset: MotionDataset;
  mass: number;
  lambda: number;
  standardize: boolean;
  autoSearch: boolean;
  validationMode: LassoValidationMode;
};

export type LassoWorkerResponse =
  | {
      id: string;
      ok: true;
      result: LassoAnalysisResult;
    }
  | {
      id: string;
      ok: false;
      error: string;
    };
