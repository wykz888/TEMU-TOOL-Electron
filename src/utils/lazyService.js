function createLazyServiceProxy(factory, options = {}) {
  let instance = null;

  function getInstance() {
    if (!instance) {
      instance = factory();

      if (typeof options.onCreate === 'function') {
        options.onCreate(instance);
      }
    }

    return instance;
  }

  return new Proxy(
    {},
    {
      get(_target, propertyName) {
        if (propertyName === '__getInstance') {
          return getInstance;
        }

        if (propertyName === '__hasInstance') {
          return () => Boolean(instance);
        }

        if (propertyName === 'then') {
          return undefined;
        }

        if (propertyName === Symbol.for('nodejs.util.inspect.custom')) {
          return () => '[LazyServiceProxy]';
        }

        if (typeof propertyName === 'symbol') {
          if (propertyName === Symbol.toStringTag) {
            return 'LazyServiceProxy';
          }

          return undefined;
        }

        const target = getInstance();
        const value = target[propertyName];

        return typeof value === 'function' ? value.bind(target) : value;
      },
      set(_target, propertyName, value) {
        const target = getInstance();
        target[propertyName] = value;
        return true;
      }
    }
  );
}

module.exports = {
  createLazyServiceProxy
};
