import { createBatchAiTitleDialog } from '../shared/batchAiTitle/useBatchAiTitleDialog.js';

export function useBatchAiTitleDialog() {
  return createBatchAiTitleDialog({
    includeOutputLanguage: false
  });
}
