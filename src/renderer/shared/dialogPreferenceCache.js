function hasOwnValue(source, key) {
  return Object.prototype.hasOwnProperty.call(source, key);
}

export function pickPreferenceFields(source, keys, emptyTextKeys = []) {
  const input = source && typeof source === 'object' ? source : {};
  const nextPreferences = {};

  keys.forEach((key) => {
    if (!hasOwnValue(input, key)) return;

    const value = input[key];
    const allowEmptyText = emptyTextKeys.includes(key);

    if (value === undefined || value === null) return;
    if (value === '' && !allowEmptyText) return;

    nextPreferences[key] = value;
  });

  return nextPreferences;
}

export function rememberPreferenceFields(cacheRef, source, keys, emptyTextKeys = []) {
  const nextPreferences = pickPreferenceFields(source, keys, emptyTextKeys);

  if (!Object.keys(nextPreferences).length) {
    return cacheRef.value;
  }

  cacheRef.value = {
    ...cacheRef.value,
    ...nextPreferences
  };

  return cacheRef.value;
}
