function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeAccountValue(value) {
  return String(value || '').replace(/[\s\u200B-\u200D\uFEFF]+/g, '');
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeAccountValue(value));
}

function resolveAccountIdentity(input) {
  const source = input && typeof input === 'object' ? input : {};
  const explicitAccountType = normalizeText(source.accountType).toLowerCase();
  const email = normalizeAccountValue(source.email);
  const accountValue = normalizeAccountValue(source.accountValue);
  const phoneNumber = normalizeAccountValue(source.phoneNumber);

  if (explicitAccountType === 'email') {
    const explicitEmail = email || accountValue || phoneNumber;

    if (explicitEmail) {
      return {
        email: explicitEmail,
        phoneNumber: '',
        accountValue: explicitEmail,
        accountType: 'email'
      };
    }
  }

  if (explicitAccountType === 'phone') {
    const explicitPhoneNumber = phoneNumber || accountValue || email;

    if (explicitPhoneNumber) {
      return {
        email: '',
        phoneNumber: explicitPhoneNumber,
        accountValue: explicitPhoneNumber,
        accountType: 'phone'
      };
    }
  }

  if (isEmail(email)) {
    return {
      email,
      phoneNumber: '',
      accountValue: email,
      accountType: 'email'
    };
  }

  if (isEmail(accountValue)) {
    return {
      email: accountValue,
      phoneNumber: '',
      accountValue,
      accountType: 'email'
    };
  }

  if (isEmail(phoneNumber)) {
    return {
      email: phoneNumber,
      phoneNumber: '',
      accountValue: phoneNumber,
      accountType: 'email'
    };
  }

  const resolvedPhoneNumber = phoneNumber || accountValue;

  return {
    email: '',
    phoneNumber: resolvedPhoneNumber,
    accountValue: resolvedPhoneNumber,
    accountType: resolvedPhoneNumber ? 'phone' : ''
  };
}

function withNormalizedAccountIdentity(input) {
  const source = input && typeof input === 'object' ? input : {};
  const identity = resolveAccountIdentity(source);

  return {
    ...source,
    phoneNumber: identity.phoneNumber,
    email: identity.email,
    accountValue: identity.accountValue,
    accountType: identity.accountType
  };
}

module.exports = {
  isEmail,
  resolveAccountIdentity,
  withNormalizedAccountIdentity
};
