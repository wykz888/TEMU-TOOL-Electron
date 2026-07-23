const STATE_BY_GLOBAL = new WeakMap();

function normalizeText(value) {
  return String(value || '').trim();
}

function buildNativeFunctionSource(fn, nativeName) {
  const normalizedName = normalizeText(nativeName) || normalizeText(fn && fn.name);

  return normalizedName
    ? `function ${normalizedName}() { [native code] }`
    : 'function () { [native code] }';
}

function createNoopMasker() {
  return {
    maskNativeFunction(fn) {
      return fn;
    }
  };
}

function createFingerprintNativeMasker(globalObject) {
  const root = globalObject && typeof globalObject === 'object' ? globalObject : globalThis;

  if (STATE_BY_GLOBAL.has(root)) {
    return STATE_BY_GLOBAL.get(root);
  }

  const FunctionConstructor = root.Function || Function;
  const functionPrototype = FunctionConstructor && FunctionConstructor.prototype;
  const nativeToString = functionPrototype && functionPrototype.toString;

  if (!functionPrototype || typeof nativeToString !== 'function') {
    const noopMasker = createNoopMasker();
    STATE_BY_GLOBAL.set(root, noopMasker);
    return noopMasker;
  }

  const nativeSourceByFunction = new WeakMap();

  function maskNativeFunction(fn, nativeName) {
    if (typeof fn !== 'function') {
      return fn;
    }

    nativeSourceByFunction.set(fn, buildNativeFunctionSource(fn, nativeName));
    return fn;
  }

  const patchedToString = function toString() {
    if (typeof this === 'function' && nativeSourceByFunction.has(this)) {
      return nativeSourceByFunction.get(this);
    }

    return nativeToString.call(this);
  };

  maskNativeFunction(patchedToString, 'toString');

  try {
    const nativeDescriptor = Object.getOwnPropertyDescriptor(functionPrototype, 'toString') || {};

    Object.defineProperty(functionPrototype, 'toString', {
      configurable: nativeDescriptor.configurable !== false,
      enumerable: nativeDescriptor.enumerable === true,
      writable: nativeDescriptor.writable !== false,
      value: patchedToString
    });
  } catch (_error) {
    // Ignore masking installation failures. The original browser API remains usable.
  }

  const masker = {
    maskNativeFunction
  };

  STATE_BY_GLOBAL.set(root, masker);
  return masker;
}

module.exports = {
  createFingerprintNativeMasker
};
