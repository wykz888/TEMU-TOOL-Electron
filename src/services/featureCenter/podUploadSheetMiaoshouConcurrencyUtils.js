function normalizeBoundedInteger(value, fallback, minValue, maxValue) {
  const parsed = Number.parseInt(value, 10);
  const initialValue = Number.isFinite(parsed) ? parsed : fallback;

  return Math.max(minValue, Math.min(maxValue, initialValue));
}

function createAsyncLimiter(concurrency) {
  const limit = normalizeBoundedInteger(concurrency, 1, 1, Number.MAX_SAFE_INTEGER);
  const queue = [];
  let activeCount = 0;

  function isCanceled(item) {
    return (
      item
      && typeof item.shouldRun === 'function'
      && item.shouldRun() === false
    );
  }

  function createCanceledError(item) {
    if (item && typeof item.createCanceledError === 'function') {
      return item.createCanceledError();
    }

    const error = new Error('Task canceled.');
    error.code = 'ASYNC_LIMITER_TASK_CANCELED';
    return error;
  }

  function runNext() {
    while (activeCount < limit && queue.length > 0) {
      const item = queue.shift();

      if (isCanceled(item)) {
        item.reject(createCanceledError(item));
        continue;
      }

      activeCount += 1;

      Promise.resolve()
        .then(item.task)
        .then(item.resolve, item.reject)
        .finally(() => {
          activeCount -= 1;
          runNext();
        });
    }
  }

  return function limitTask(task, options = {}) {
    return new Promise((resolve, reject) => {
      queue.push({
        task: typeof task === 'function' ? task : () => task,
        shouldRun: options && typeof options.shouldRun === 'function' ? options.shouldRun : null,
        createCanceledError: options && typeof options.createCanceledError === 'function'
          ? options.createCanceledError
          : null,
        resolve,
        reject
      });
      runNext();
    });
  };
}

function yieldToEventLoop() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

async function mapWithConcurrency(items, concurrency, worker, options = {}) {
  const targetItems = Array.isArray(items) ? items : [];
  const results = new Array(targetItems.length);
  const job = options && options.job ? options.job : null;
  let cursor = 0;

  async function consume() {
    while (true) {
      if (job && job.canceled) {
        return;
      }

      const currentIndex = cursor;

      if (currentIndex >= targetItems.length) {
        return;
      }

      cursor += 1;
      results[currentIndex] = await worker(targetItems[currentIndex], currentIndex);
      await yieldToEventLoop();
    }
  }

  const workerCount = normalizeBoundedInteger(
    concurrency,
    1,
    1,
    targetItems.length || 1
  );

  await Promise.all(Array.from({ length: workerCount }, () => consume()));
  return results;
}

module.exports = {
  createAsyncLimiter,
  mapWithConcurrency,
  normalizeBoundedInteger,
  yieldToEventLoop
};
