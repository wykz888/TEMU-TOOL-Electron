const {
  normalizeText
} = require('./podSuitePsdRuntimeRules');

const PSD_MOCKUP_OPEN_MAX_ATTEMPTS = 2;
const PSD_MOCKUP_ITEM_RETRY_MAX_ATTEMPTS = 3;
const PSD_MOCKUP_OPEN_TIMEOUT_PATTERN = /PSD\u6837\u673a\u6253\u5f00\u8d85\u65f6/;

function createPsdTaskSignal(options = {}) {
  return {
    aborted: false,
    reason: '',
    session: null,
    engineWindowVisible: options.showEngineWindow === true,
    abort(reason) {
      this.aborted = true;
      this.reason = normalizeText(reason) || 'PSD\u5957\u56fe\u5df2\u505c\u6b62\u3002';
      if (this.session && typeof this.session.destroy === 'function') {
        void this.session.destroy();
      }
    },
    setSession(session) {
      this.session = session || null;
      if (this.aborted && this.session && typeof this.session.destroy === 'function') {
        void this.session.destroy();
      }
    },
    setEngineWindowVisible(visible) {
      this.engineWindowVisible = visible === true;
      if (this.session && typeof this.session.setEngineWindowVisible === 'function') {
        return this.session.setEngineWindowVisible(this.engineWindowVisible);
      }

      return false;
    }
  };
}

async function runLimitedTasks(items, limit, worker) {
  const sourceItems = Array.isArray(items) ? items : [];
  const normalizedLimit = Math.max(1, Math.min(sourceItems.length || 1, Math.round(Number(limit) || 1)));
  const results = new Array(sourceItems.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < sourceItems.length) {
      const itemIndex = nextIndex;
      nextIndex += 1;
      results[itemIndex] = await worker(sourceItems[itemIndex], itemIndex);
    }
  }

  await Promise.all(Array.from({
    length: normalizedLimit
  }, runWorker));

  return results;
}

function createAsyncSlotLimiter(limit) {
  const normalizedLimit = Math.max(1, Math.round(Number(limit) || 1));
  const waiters = [];
  let activeCount = 0;

  function release() {
    const nextWaiter = waiters.shift();
    if (nextWaiter) {
      nextWaiter(release);
      return;
    }

    activeCount = Math.max(0, activeCount - 1);
  }

  return {
    acquire() {
      if (activeCount < normalizedLimit) {
        activeCount += 1;
        return Promise.resolve(release);
      }

      return new Promise((resolve) => {
        waiters.push(resolve);
      });
    }
  };
}

function throwIfPsdTaskCanceled(taskSignal) {
  if (taskSignal && taskSignal.aborted) {
    throw new Error(normalizeText(taskSignal.reason) || 'PSD\u5957\u56fe\u5df2\u505c\u6b62\u3002');
  }
}

function isRecoverablePsdMockupOpenError(error) {
  const message = String(error && error.message || error || '');
  return PSD_MOCKUP_OPEN_TIMEOUT_PATTERN.test(message);
}

module.exports = {
  PSD_MOCKUP_ITEM_RETRY_MAX_ATTEMPTS,
  PSD_MOCKUP_OPEN_MAX_ATTEMPTS,
  createAsyncSlotLimiter,
  createPsdTaskSignal,
  isRecoverablePsdMockupOpenError,
  runLimitedTasks,
  throwIfPsdTaskCanceled
};
