import type { LassoWorkerRequest, LassoWorkerResponse } from '../types/lassoWorker';
import { fitLassoAnalysis } from '../utils/lasso';

self.onmessage = (event: MessageEvent<LassoWorkerRequest>) => {
  const request = event.data;

  try {
    const result = fitLassoAnalysis(request.terms, request.dataset, {
      lambda: request.lambda,
      standardize: request.standardize,
      autoSearch: request.autoSearch,
      validationMode: request.validationMode,
    });

    self.postMessage({
      id: request.id,
      ok: true,
      result,
    } satisfies LassoWorkerResponse);
  } catch (error) {
    self.postMessage({
      id: request.id,
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Lasso 계산 중 알 수 없는 문제가 발생했습니다.',
    } satisfies LassoWorkerResponse);
  }
};

export {};
