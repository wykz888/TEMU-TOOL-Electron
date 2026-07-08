function serializePayload(payload) {
  return JSON.stringify(payload || {}).replace(/</g, '\\u003c');
}

function buildLocalStorageExportScript() {
  return `
    (async () => {
      const items = [];

      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);

        if (typeof key !== 'string' || !key) {
          continue;
        }

        const rawValue = window.localStorage.getItem(key);

        items.push({
          key,
          value: rawValue == null ? '' : String(rawValue)
        });
      }

      items.sort((left, right) => left.key.localeCompare(right.key));

      return {
        origin: window.location.origin || '',
        itemCount: items.length,
        items
      };
    })();
  `;
}

function buildLocalStorageImportScript(payload) {
  return `
    (async () => {
      const snapshot = ${serializePayload(payload)};
      const items = Array.isArray(snapshot && snapshot.items) ? snapshot.items : [];

      window.localStorage.clear();

      for (const item of items) {
        const key = String(item && item.key || '').trim();

        if (!key) {
          continue;
        }

        const value = item && item.value != null ? String(item.value) : '';
        window.localStorage.setItem(key, value);
      }

      return {
        origin: window.location.origin || '',
        itemCount: window.localStorage.length
      };
    })();
  `;
}

function buildIndexedDbExportScript() {
  return `
    (async () => {
      function isPlainObject(value) {
        return Object.prototype.toString.call(value) === '[object Object]';
      }

      function cloneByteArray(buffer, byteOffset, byteLength) {
        return Array.from(new Uint8Array(buffer.slice(byteOffset, byteOffset + byteLength)));
      }

      async function serializeValue(value, seen = new WeakMap()) {
        if (value === null) {
          return null;
        }

        if (value === undefined) {
          return {
            __type: 'undefined'
          };
        }

        const valueType = typeof value;

        if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
          return value;
        }

        if (valueType === 'bigint') {
          return {
            __type: 'bigint',
            value: String(value)
          };
        }

        if (valueType !== 'object') {
          return {
            __type: 'unsupported',
            value: String(value)
          };
        }

        if (seen.has(value)) {
          return {
            __type: 'circular'
          };
        }

        seen.set(value, true);

        try {
          if (value instanceof Date) {
            return {
              __type: 'date',
              value: value.toISOString()
            };
          }

          if (value instanceof RegExp) {
            return {
              __type: 'regexp',
              source: value.source,
              flags: value.flags
            };
          }

          if (value instanceof ArrayBuffer) {
            return {
              __type: 'array-buffer',
              data: cloneByteArray(value, 0, value.byteLength)
            };
          }

          if (ArrayBuffer.isView(value)) {
            return {
              __type: 'typed-array',
              subtype: value.constructor && value.constructor.name ? value.constructor.name : 'Uint8Array',
              data: cloneByteArray(value.buffer, value.byteOffset, value.byteLength)
            };
          }

          if (typeof Blob !== 'undefined' && value instanceof Blob) {
            const buffer = await value.arrayBuffer();

            return {
              __type: value instanceof File ? 'file' : 'blob',
              mimeType: value.type || '',
              name: value instanceof File ? value.name || '' : '',
              lastModified: value instanceof File ? Number(value.lastModified) || 0 : 0,
              data: cloneByteArray(buffer, 0, buffer.byteLength)
            };
          }

          if (Array.isArray(value)) {
            const result = [];

            for (const item of value) {
              result.push(await serializeValue(item, seen));
            }

            return result;
          }

          if (value instanceof Map) {
            const entries = [];

            for (const [mapKey, mapValue] of value.entries()) {
              entries.push([
                await serializeValue(mapKey, seen),
                await serializeValue(mapValue, seen)
              ]);
            }

            return {
              __type: 'map',
              entries
            };
          }

          if (value instanceof Set) {
            const entries = [];

            for (const setValue of value.values()) {
              entries.push(await serializeValue(setValue, seen));
            }

            return {
              __type: 'set',
              entries
            };
          }

          if (isPlainObject(value)) {
            const result = {};
            const keys = Object.keys(value).sort();

            for (const key of keys) {
              result[key] = await serializeValue(value[key], seen);
            }

            return result;
          }

          return {
            __type: 'object',
            subtype: value.constructor && value.constructor.name ? value.constructor.name : 'Object',
            value: await serializeValue(Object.assign({}, value), seen)
          };
        } finally {
          seen.delete(value);
        }
      }

      function openDatabase(name) {
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(name);

          request.onerror = () => {
            reject(request.error || new Error('indexeddb-open-failed'));
          };

          request.onsuccess = () => {
            resolve(request.result);
          };
        });
      }

      function awaitTransaction(transaction) {
        return new Promise((resolve, reject) => {
          transaction.oncomplete = () => {
            resolve();
          };
          transaction.onerror = () => {
            reject(transaction.error || new Error('indexeddb-transaction-failed'));
          };
          transaction.onabort = () => {
            reject(transaction.error || new Error('indexeddb-transaction-aborted'));
          };
        });
      }

      async function exportObjectStore(database, storeName) {
        const transaction = database.transaction(storeName, 'readonly');
        const objectStore = transaction.objectStore(storeName);
        const records = [];

        await new Promise((resolve, reject) => {
          const request = objectStore.openCursor();

          request.onerror = () => {
            reject(request.error || new Error('indexeddb-cursor-open-failed'));
          };

          request.onsuccess = async (event) => {
            const cursor = event && event.target ? event.target.result : null;

            if (!cursor) {
              resolve();
              return;
            }

            try {
              records.push({
                key: await serializeValue(cursor.primaryKey),
                value: await serializeValue(cursor.value)
              });
              cursor.continue();
            } catch (error) {
              reject(error);
            }
          };
        });

        await awaitTransaction(transaction);

        const indexes = Array.from(objectStore.indexNames || []).map((indexName) => {
          const index = objectStore.index(indexName);

          return {
            name: index.name,
            keyPath: index.keyPath == null ? null : index.keyPath,
            unique: index.unique === true,
            multiEntry: index.multiEntry === true
          };
        });

        return {
          name: objectStore.name,
          keyPath: objectStore.keyPath == null ? null : objectStore.keyPath,
          autoIncrement: objectStore.autoIncrement === true,
          indexes,
          recordCount: records.length,
          records
        };
      }

      async function exportDatabase(name) {
        const database = await openDatabase(name);

        try {
          const storeNames = Array.from(database.objectStoreNames || []);
          const stores = [];

          for (const storeName of storeNames) {
            stores.push(await exportObjectStore(database, storeName));
          }

          return {
            name: database.name,
            version: Number(database.version) || 1,
            stores
          };
        } finally {
          database.close();
        }
      }

      if (typeof indexedDB === 'undefined') {
        return {
          origin: window.location.origin || '',
          supported: false,
          databaseCount: 0,
          objectStoreCount: 0,
          recordCount: 0,
          databases: []
        };
      }

      const rawDatabases = typeof indexedDB.databases === 'function'
        ? await indexedDB.databases()
        : [];
      const names = Array.from(new Set(
        (Array.isArray(rawDatabases) ? rawDatabases : [])
          .map((entry) => String(entry && entry.name || '').trim())
          .filter(Boolean)
      )).sort((left, right) => left.localeCompare(right));
      const databases = [];

      for (const name of names) {
        databases.push(await exportDatabase(name));
      }

      return {
        origin: window.location.origin || '',
        supported: true,
        databaseCount: databases.length,
        objectStoreCount: databases.reduce((count, database) => count + database.stores.length, 0),
        recordCount: databases.reduce((count, database) => (
          count + database.stores.reduce((storeCount, store) => storeCount + store.records.length, 0)
        ), 0),
        databases
      };
    })();
  `;
}

function buildIndexedDbImportScript(payload) {
  return `
    (async () => {
      const snapshot = ${serializePayload(payload)};

      function deserializeValue(value) {
        if (value === null) {
          return null;
        }

        if (value === undefined) {
          return undefined;
        }

        if (typeof value !== 'object' || Array.isArray(value)) {
          if (Array.isArray(value)) {
            return value.map((item) => deserializeValue(item));
          }

          return value;
        }

        const marker = value.__type;

        if (!marker) {
          const result = {};

          Object.keys(value).forEach((key) => {
            result[key] = deserializeValue(value[key]);
          });

          return result;
        }

        if (marker === 'undefined') {
          return undefined;
        }

        if (marker === 'bigint') {
          return BigInt(value.value || '0');
        }

        if (marker === 'date') {
          return new Date(value.value || 0);
        }

        if (marker === 'regexp') {
          return new RegExp(value.source || '', value.flags || '');
        }

        if (marker === 'array-buffer') {
          return Uint8Array.from(Array.isArray(value.data) ? value.data : []).buffer;
        }

        if (marker === 'typed-array') {
          const buffer = Uint8Array.from(Array.isArray(value.data) ? value.data : []).buffer;
          const TypedArrayConstructor = globalThis[value.subtype] || Uint8Array;

          return new TypedArrayConstructor(buffer);
        }

        if (marker === 'blob') {
          return new Blob([
            Uint8Array.from(Array.isArray(value.data) ? value.data : [])
          ], {
            type: value.mimeType || ''
          });
        }

        if (marker === 'file') {
          return new File([
            Uint8Array.from(Array.isArray(value.data) ? value.data : [])
          ], value.name || 'file.bin', {
            type: value.mimeType || '',
            lastModified: Number(value.lastModified) || 0
          });
        }

        if (marker === 'map') {
          return new Map(
            (Array.isArray(value.entries) ? value.entries : []).map((entry) => [
              deserializeValue(Array.isArray(entry) ? entry[0] : undefined),
              deserializeValue(Array.isArray(entry) ? entry[1] : undefined)
            ])
          );
        }

        if (marker === 'set') {
          return new Set(
            (Array.isArray(value.entries) ? value.entries : []).map((entry) => deserializeValue(entry))
          );
        }

        if (marker === 'object') {
          return deserializeValue(value.value || {});
        }

        if (marker === 'circular' || marker === 'unsupported') {
          return null;
        }

        const fallbackResult = {};

        Object.keys(value).forEach((key) => {
          if (key === '__type') {
            return;
          }

          fallbackResult[key] = deserializeValue(value[key]);
        });

        return fallbackResult;
      }

      function deleteDatabase(name) {
        return new Promise((resolve, reject) => {
          const request = indexedDB.deleteDatabase(name);
          let blocked = false;

          request.onerror = () => {
            reject(request.error || new Error('indexeddb-delete-failed'));
          };

          request.onblocked = () => {
            blocked = true;
            setTimeout(() => {
              reject(new Error('indexeddb-delete-blocked'));
            }, 2000);
          };

          request.onsuccess = () => {
            if (!blocked) {
              resolve();
            }
          };
        });
      }

      function awaitTransaction(transaction) {
        return new Promise((resolve, reject) => {
          transaction.oncomplete = () => {
            resolve();
          };
          transaction.onerror = () => {
            reject(transaction.error || new Error('indexeddb-transaction-failed'));
          };
          transaction.onabort = () => {
            reject(transaction.error || new Error('indexeddb-transaction-aborted'));
          };
        });
      }

      function createDatabaseSchema(databaseDefinition) {
        return new Promise((resolve, reject) => {
          const name = String(databaseDefinition && databaseDefinition.name || '').trim();
          const version = Math.max(1, Number(databaseDefinition && databaseDefinition.version) || 1);
          const request = indexedDB.open(name, version);

          request.onerror = () => {
            reject(request.error || new Error('indexeddb-schema-create-failed'));
          };

          request.onupgradeneeded = () => {
            const database = request.result;
            const stores = Array.isArray(databaseDefinition && databaseDefinition.stores)
              ? databaseDefinition.stores
              : [];

            stores.forEach((storeDefinition) => {
              const storeName = String(storeDefinition && storeDefinition.name || '').trim();

              if (!storeName || database.objectStoreNames.contains(storeName)) {
                return;
              }

              const options = {};

              if (storeDefinition && storeDefinition.keyPath != null) {
                options.keyPath = storeDefinition.keyPath;
              }

              if (storeDefinition && storeDefinition.autoIncrement === true) {
                options.autoIncrement = true;
              }

              const objectStore = database.createObjectStore(storeName, options);
              const indexes = Array.isArray(storeDefinition && storeDefinition.indexes)
                ? storeDefinition.indexes
                : [];

              indexes.forEach((indexDefinition) => {
                const indexName = String(indexDefinition && indexDefinition.name || '').trim();

                if (!indexName || objectStore.indexNames.contains(indexName)) {
                  return;
                }

                objectStore.createIndex(indexName, indexDefinition && indexDefinition.keyPath, {
                  unique: indexDefinition && indexDefinition.unique === true,
                  multiEntry: indexDefinition && indexDefinition.multiEntry === true
                });
              });
            });
          };

          request.onsuccess = () => {
            request.result.close();
            resolve();
          };
        });
      }

      async function populateDatabase(databaseDefinition) {
        await new Promise((resolve, reject) => {
          const request = indexedDB.open(String(databaseDefinition && databaseDefinition.name || '').trim());

          request.onerror = () => {
            reject(request.error || new Error('indexeddb-open-for-populate-failed'));
          };

          request.onsuccess = async () => {
            const database = request.result;

            try {
              const stores = Array.isArray(databaseDefinition && databaseDefinition.stores)
                ? databaseDefinition.stores
                : [];

              for (const storeDefinition of stores) {
                const storeName = String(storeDefinition && storeDefinition.name || '').trim();

                if (!storeName || !database.objectStoreNames.contains(storeName)) {
                  continue;
                }

                const transaction = database.transaction(storeName, 'readwrite');
                const objectStore = transaction.objectStore(storeName);
                const records = Array.isArray(storeDefinition && storeDefinition.records)
                  ? storeDefinition.records
                  : [];

                records.forEach((record) => {
                  const value = deserializeValue(record && record.value);
                  const key = deserializeValue(record && record.key);

                  if (objectStore.keyPath == null) {
                    if (key === undefined) {
                      objectStore.put(value);
                    } else {
                      objectStore.put(value, key);
                    }
                    return;
                  }

                  objectStore.put(value);
                });

                await awaitTransaction(transaction);
              }

              database.close();
              resolve();
            } catch (error) {
              database.close();
              reject(error);
            }
          };
        });
      }

      if (typeof indexedDB === 'undefined') {
        return {
          origin: window.location.origin || '',
          supported: false,
          databaseCount: 0,
          objectStoreCount: 0,
          recordCount: 0
        };
      }

      const existingDatabases = typeof indexedDB.databases === 'function'
        ? await indexedDB.databases()
        : [];
      const existingNames = Array.from(new Set(
        (Array.isArray(existingDatabases) ? existingDatabases : [])
          .map((entry) => String(entry && entry.name || '').trim())
          .filter(Boolean)
      ));

      for (const name of existingNames) {
        await deleteDatabase(name);
      }

      const databases = Array.isArray(snapshot && snapshot.databases)
        ? snapshot.databases
        : [];

      for (const databaseDefinition of databases) {
        await createDatabaseSchema(databaseDefinition);
      }

      for (const databaseDefinition of databases) {
        await populateDatabase(databaseDefinition);
      }

      return {
        origin: window.location.origin || '',
        supported: true,
        databaseCount: databases.length,
        objectStoreCount: databases.reduce((count, database) => (
          count + (Array.isArray(database && database.stores) ? database.stores.length : 0)
        ), 0),
        recordCount: databases.reduce((count, database) => (
          count + (Array.isArray(database && database.stores)
            ? database.stores.reduce((storeCount, store) => (
              storeCount + (Array.isArray(store && store.records) ? store.records.length : 0)
            ), 0)
            : 0)
        ), 0)
      };
    })();
  `;
}

module.exports = {
  buildLocalStorageExportScript,
  buildLocalStorageImportScript,
  buildIndexedDbExportScript,
  buildIndexedDbImportScript
};
