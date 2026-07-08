const { normalizeText } = require('../shopManagement/common');
const {
  buildCostLookupCandidates,
  buildCostPrimaryKey,
  normalizeCostIdentity
} = require('./operationsCostIdentity');
const {
  createOperationsSharedCostStore
} = require('./operationsSharedCostStore');

const COST_PROFILE_VERSION = 1;

function createOperationsSharedCostService({
  sessionStore,
  featureCenterProfileService,
  runtimeLogger
}) {
  const store = createOperationsSharedCostStore({
    sessionStore,
    featureCenterProfileService
  });

  function logError(eventName, error, payload) {
    if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
      runtimeLogger.logError(eventName, error, payload);
    }
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function normalizeIntegerValue(value, fallback = 0) {
    const parsedValue = Number.parseInt(value, 10);
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  }

  function normalizePositiveDecimalValue(value, fallback = 0) {
    if (value === '' || value === null || value === undefined) {
      return fallback;
    }

    const matchedNumber = String(value).match(/-?\d+(?:\.\d+)?/);
    const parsedValue = matchedNumber
      ? Number.parseFloat(matchedNumber[0])
      : Number.NaN;

    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      return fallback;
    }

    return Number(parsedValue);
  }

  function normalizeSelectedShopIds(shopIds) {
    return Array.from(new Set(
      (Array.isArray(shopIds) ? shopIds : [])
        .map((shopId) => normalizeText(shopId))
        .filter(Boolean)
    ));
  }

  function buildDefaultShopCostProfile(owner, shopId) {
    return {
      version: COST_PROFILE_VERSION,
      owner: owner ? {
        userId: owner.userId,
        username: owner.username,
        userKey: owner.userKey
      } : null,
      shopId: normalizeText(shopId),
      updatedAt: '',
      entries: []
    };
  }

  function getPayloadTimestamp(payload) {
    const timestamp = Date.parse(
      payload && typeof payload === 'object' && payload.updatedAt
        ? payload.updatedAt
        : ''
    );

    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function pickNewerPayload(localPayload, cloudPayload) {
    if (localPayload && cloudPayload) {
      return getPayloadTimestamp(cloudPayload) > getPayloadTimestamp(localPayload)
        ? { source: 'cloud', payload: cloudPayload }
        : { source: 'local', payload: localPayload };
    }

    if (cloudPayload) {
      return { source: 'cloud', payload: cloudPayload };
    }

    if (localPayload) {
      return { source: 'local', payload: localPayload };
    }

    return { source: 'default', payload: null };
  }

  function normalizeCostEntry(entry) {
    const identity = normalizeCostIdentity(entry);
    const costPrice = Number(
      normalizePositiveDecimalValue(entry && entry.costPrice, 0).toFixed(2)
    );
    const key = buildCostPrimaryKey(identity);

    if (!key) {
      return null;
    }

    return {
      key,
      ...identity,
      costPrice,
      updatedAt: normalizeText(entry && entry.updatedAt)
    };
  }

  function normalizeShopCostProfile(profile, owner, shopId) {
    const baseProfile = buildDefaultShopCostProfile(owner, shopId);
    const input = profile && typeof profile === 'object' && !Array.isArray(profile)
      ? profile
      : {};
    const entryMap = new Map();

    (Array.isArray(input && input.entries) ? input.entries : []).forEach((entry) => {
      const normalizedEntry = normalizeCostEntry(entry);

      if (!normalizedEntry || !normalizedEntry.key || normalizedEntry.costPrice <= 0) {
        return;
      }

      entryMap.set(normalizedEntry.key, normalizedEntry);
    });

    return {
      ...baseProfile,
      updatedAt: normalizeText(input && input.updatedAt),
      entries: Array.from(entryMap.values()).sort((left, right) => {
        const leftStation = normalizeText(left && left.station) || normalizeText(left && left.stationLabel);
        const rightStation = normalizeText(right && right.station) || normalizeText(right && right.stationLabel);
        const stationCompare = leftStation.localeCompare(rightStation, 'zh-CN');

        if (stationCompare !== 0) {
          return stationCompare;
        }

        return normalizeText(left && left.spec).localeCompare(
          normalizeText(right && right.spec),
          'zh-CN'
        );
      })
    };
  }

  function buildRequestedShopIds(payload = {}) {
    return normalizeSelectedShopIds([
      ...(Array.isArray(payload && payload.shopIds) ? payload.shopIds : []),
      ...(Array.isArray(payload && payload.entries)
        ? payload.entries.map((entry) => entry && entry.shopId)
        : [])
    ]);
  }

  function buildRequestedEntryKeys(payload = {}) {
    const requestedEntryKeys = new Set();

    (Array.isArray(payload && payload.entries) ? payload.entries : []).forEach((entry) => {
      buildCostLookupCandidates(normalizeCostIdentity(entry)).forEach((candidateKey) => {
        if (candidateKey) {
          requestedEntryKeys.add(candidateKey);
        }
      });

      const primaryKey = buildCostPrimaryKey(normalizeCostIdentity(entry));

      if (primaryKey) {
        requestedEntryKeys.add(primaryKey);
      }
    });

    return requestedEntryKeys;
  }

  async function getShopCostProfile(shopId, options = {}) {
    const readResult = await store.readShopCostProfile(shopId, options);
    const owner = readResult.owner || store.getOwner();
    const newerPayload = pickNewerPayload(readResult.localProfile, readResult.cloudProfile);
    const profile = normalizeShopCostProfile(newerPayload.payload, owner, shopId);

    return {
      profile,
      source: newerPayload.source
    };
  }

  async function getCostSnapshot(payload = {}) {
    const requestedShopIds = buildRequestedShopIds(payload);
    const requestedEntryKeys = buildRequestedEntryKeys(payload);
    const shouldRefreshCloud = payload && payload.refreshCloud === true;
    const entries = [];
    let updatedAt = '';

    for (const shopId of requestedShopIds) {
      const profileResult = await getShopCostProfile(shopId, {
        refreshCloud: shouldRefreshCloud
      });
      const profile = profileResult && profileResult.profile ? profileResult.profile : null;

      if (!profile) {
        continue;
      }

      if (
        normalizeText(profile.updatedAt)
        && (!updatedAt || Date.parse(profile.updatedAt) > Date.parse(updatedAt || 0))
      ) {
        updatedAt = profile.updatedAt;
      }

      (Array.isArray(profile.entries) ? profile.entries : []).forEach((entry) => {
        if (requestedEntryKeys.size > 0) {
          const storedEntryKeys = new Set();

          [
            normalizeText(entry && entry.key),
            buildCostPrimaryKey(normalizeCostIdentity(entry))
          ]
            .concat(buildCostLookupCandidates(normalizeCostIdentity(entry)))
            .map((candidateKey) => normalizeText(candidateKey))
            .filter(Boolean)
            .forEach((candidateKey) => {
              storedEntryKeys.add(candidateKey);
            });

          const matched = Array.from(storedEntryKeys.values()).some((candidateKey) => requestedEntryKeys.has(candidateKey));

          if (!matched) {
            return;
          }
        }

        entries.push({
          shopId: normalizeText(entry && entry.shopId),
          shopName: normalizeText(entry && entry.shopName),
          station: normalizeText(entry && entry.station),
          stationLabel: normalizeText(entry && entry.stationLabel),
          category: normalizeText(entry && entry.category),
          categoryLabel: normalizeText(entry && entry.categoryLabel),
          categoryTrail: normalizeText(entry && entry.categoryTrail),
          skuId: normalizeText(entry && entry.skuId),
          skuCode: normalizeText(entry && entry.skuCode),
          skcId: normalizeText(entry && entry.skcId),
          skcCode: normalizeText(entry && entry.skcCode),
          spec: normalizeText(entry && entry.spec),
          specAliases: Array.isArray(entry && entry.specAliases)
            ? entry.specAliases.map((specAlias) => normalizeText(specAlias)).filter(Boolean)
            : [],
          costPrice: Number(entry && entry.costPrice) || 0,
          updatedAt: normalizeText(entry && entry.updatedAt)
        });
      });
    }

    return {
      updatedAt,
      source: requestedShopIds.length > 0 ? 'shop-state' : 'default',
      shopIds: requestedShopIds,
      entryCount: entries.length,
      entries
    };
  }

  async function saveCostEntries(payload = {}) {
    const owner = store.getOwner();
    const normalizedEntries = (Array.isArray(payload && payload.entries) ? payload.entries : [])
      .map((entry) => {
        const identity = normalizeCostIdentity(entry);
        const costPrice = Number(
          normalizePositiveDecimalValue(entry && entry.costPrice, 0).toFixed(2)
        );

        return {
          ...identity,
          costPrice
        };
      })
      .filter((entry) => normalizeText(entry && entry.shopId) && buildCostPrimaryKey(entry));

    if (normalizedEntries.length <= 0) {
      return {
        updatedAt: nowIso(),
        updatedEntryCount: 0,
        updatedShopCount: 0,
        cloudSynced: true,
        warning: ''
      };
    }

    const entriesByShopId = new Map();
    let cloudSynced = true;
    const warnings = [];
    let updatedEntryCount = 0;
    let updatedShopCount = 0;
    const updatedAt = nowIso();

    normalizedEntries.forEach((entry) => {
      if (!entriesByShopId.has(entry.shopId)) {
        entriesByShopId.set(entry.shopId, []);
      }

      entriesByShopId.get(entry.shopId).push(entry);
    });

    for (const [shopId, entries] of entriesByShopId.entries()) {
      const profileResult = await getShopCostProfile(shopId);
      const currentProfile = normalizeShopCostProfile(
        profileResult && profileResult.profile,
        owner,
        shopId
      );
      const nextEntryMap = new Map(
        currentProfile.entries.map((entry) => [normalizeText(entry && entry.key), entry])
      );

      entries.forEach((entry) => {
        const nextEntry = normalizeCostEntry({
          ...entry,
          updatedAt
        });
        const entryKey = buildCostPrimaryKey(entry);

        if (!entryKey) {
          return;
        }

        if (!nextEntry || !Number.isFinite(nextEntry.costPrice) || nextEntry.costPrice <= 0) {
          nextEntryMap.delete(entryKey);
          return;
        }

        nextEntryMap.set(entryKey, nextEntry);
      });

      const nextProfile = normalizeShopCostProfile({
        ...currentProfile,
        shopId,
        updatedAt,
        entries: Array.from(nextEntryMap.values())
      }, owner, shopId);
      const persistResult = await store.writeShopCostProfile({
        owner,
        shopId,
        profile: nextProfile
      });

      updatedEntryCount += entries.length;
      updatedShopCount += 1;
      cloudSynced = cloudSynced && persistResult.cloudSynced === true;

      if (persistResult.warning) {
        warnings.push(persistResult.warning);
      }
    }

    return {
      updatedAt,
      updatedEntryCount,
      updatedShopCount,
      cloudSynced,
      warning: warnings.filter(Boolean).join('\n')
    };
  }

  return {
    async getCostSnapshot(payload = {}) {
      try {
        return await getCostSnapshot(payload);
      } catch (error) {
        logError('operations_shared_cost_get_snapshot_failed', error, {
          shopCount: buildRequestedShopIds(payload).length
        });
        throw error;
      }
    },

    async saveCostEntries(payload = {}) {
      try {
        return await saveCostEntries(payload);
      } catch (error) {
        logError('operations_shared_cost_save_entries_failed', error, {
          entryCount: Array.isArray(payload && payload.entries) ? payload.entries.length : 0
        });
        throw error;
      }
    }
  };
}

module.exports = {
  createOperationsSharedCostService
};
