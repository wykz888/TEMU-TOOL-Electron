const crypto = require('node:crypto');
const {
  normalizeText,
  resolveAccountIdentity
} = require('../services/shopManagement/common');

const LOGIN_HOST_PATTERNS = [
  /(^|\.)kuajingmaihuo\.com$/i
];

const LOGIN_PATH_PATTERNS = [
  /^\/settle\/seller-login$/i,
  /^\/settle\/activity-login$/i,
  /^\/login$/i
];
const LOGIN_AUTOFILL_HELPER_KEY = '__TEMU_TOOLBOX_LOGIN_AUTOFILL_HELPER__';
const LOGIN_AUTOFILL_HELPER_VERSION = '2026-05-16-auth-fix-4';

function hasCompleteAuthConfig(authConfig) {
  const accountIdentity = resolveAccountIdentity(authConfig);
  return Boolean(
    authConfig
    && accountIdentity.accountValue
    && normalizeText(authConfig.loginPassword)
  );
}

function isLoginAutofillUrl(url) {
  if (!url) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    const hostname = normalizeText(parsedUrl.hostname).toLowerCase();
    const pathname = normalizeText(parsedUrl.pathname).toLowerCase();

    return (
      LOGIN_HOST_PATTERNS.some((pattern) => pattern.test(hostname))
      && LOGIN_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
    );
  } catch (_error) {
    return false;
  }
}

function buildLoginAutofillScript(authConfig) {
  const accountIdentity = resolveAccountIdentity(authConfig);
  const payload = JSON.stringify({
    phoneNumber: accountIdentity.phoneNumber,
    email: accountIdentity.email,
    accountValue: accountIdentity.accountValue,
    accountType: accountIdentity.accountType,
    loginPassword: normalizeText(authConfig && authConfig.loginPassword)
  });

  return `
    (() => {
      const runtimeAuthConfig = ${payload};
      const helperVersion = ${JSON.stringify(LOGIN_AUTOFILL_HELPER_VERSION)};
      const storageKey = 'temu_toolbox_browser_saved_auth_v1';
      const retryLimit = 18;
      const retryIntervalMs = 800;
      const accountHintPatterns = [
        /phone/i,
        /mobile/i,
        /email/i,
        /mail/i,
        /account/i,
        /username/i,
        /login/i,
        /seller/i,
        /user/i,
        /\\u624b\\u673a/u,
        /\\u90ae\\u7bb1/u,
        /\\u8d26\\u53f7/u,
        /\\u767b\\u5f55/u
      ];
      const passwordHintPatterns = [
        /password/i,
        /passwd/i,
        /pwd/i,
        /\\u5bc6\\u7801/u
      ];
      const otpHintPatterns = [
        /otp/i,
        /code/i,
        /captcha/i,
        /verify/i,
        /verification/i,
        /sms/i,
        /\\u9a8c\\u8bc1/u,
        /\\u77ed\\u4fe1/u
      ];
      const verificationHintPatterns = [
        /captcha/i,
        /slider/i,
        /slide/i,
        /gee/i,
        /geetest/i,
        /turnstile/i,
        /challenge/i,
        /security/i,
        /verification\\s*code/i,
        /sms\\s*code/i,
        /one\\s*time\\s*(password|code)/i,
        /otp/i,
        /\\u9a8c\\u8bc1\\u7801/u,
        /\\u77ed\\u4fe1\\u9a8c\\u8bc1/u,
        /\\u6ED1\\u52A8/u,
        /\\u62D6\\u52A8/u,
        /\\u5B89\\u5168\\u9A8C\\u8BC1/u,
        /\\u56FE\\u5F62\\u9A8C\\u8BC1/u
      ];
      const hongKongPatterns = [
        /hong\\s*kong/i,
        /\\bhk\\b/i,
        /\\+?\\s*852\\b/,
        /\\u9999\\u6e2f/u
      ];
      const mainlandPatterns = [
        /mainland/i,
        /\\+?\\s*86\\b/,
        /\\u4e2d\\u56fd\\u5927\\u9646/u,
        /\\u5927\\u9646/u
      ];
      const accountLoginModeHintPatterns = [
        /account\\s*password\\s*login/i,
        /account\\s*login/i,
        /email\\s*login/i,
        /email/i,
        /password\\s*login/i,
        /\\u624B\\u673A\\u53F7\\u767B\\u5F55/u,
        /\\u90AE\\u7BB1/u,
        /\\u90AE\\u7BB1\\u767B\\u5F55/u,
        /\\u8d26\\u53f7\\u5bc6\\u7801\\u767b\\u5f55/u,
        /\\u8d26\\u53f7\\u767b\\u5f55/u,
        /\\u5bc6\\u7801\\u767b\\u5f55/u
      ];
      const otpLoginModeHintPatterns = [
        /sms\\s*login/i,
        /code\\s*login/i,
        /otp/i,
        /\\u9a8c\\u8bc1\\u7801\\u767b\\u5f55/u,
        /\\u77ed\\u4fe1\\u767b\\u5f55/u
      ];
      const scanLoginModeHintPatterns = [
        /scan\\s*(qr|code)\\s*login/i,
        /qr\\s*login/i,
        /scan\\s*login/i,
        /\\u626b\\u7801\\u767b\\u5f55/u,
        /\\u626b\\u7801/u
      ];
      const authorizationAgreementHintPatterns = [
        /\\u60a8\\u6388\\u6743/u,
        /\\u6388\\u6743/u,
        /\\u5373\\u5c06\\u524d\\u5f80/u,
        /\\u8de8\\u5883\\u5356\\u5bb6\\u4e2d\\u5fc3/u,
        /temu\\s*\\u5356\\u5bb6\\u4e2d\\u5fc3/i,
        /\\u5356\\u5bb6\\u4e2d\\u5fc3\\u5404\\u677f\\u5757/u,
        /\\u5171\\u4eab/u,
        /\\u8d26\\u53f7\\s*id/iu,
        /account\\s*id/i,
        /\\u5e97\\u94fa\\u540d\\u79f0/u,
        /shop\\s*name/i,
        /seller\\s*center/i
      ];
      const authorizationConfirmHintPatterns = [
        /\\u786e\\u8ba4\\u6388\\u6743\\u5e76\\u524d\\u5f80/u,
        /\\u6388\\u6743\\u5e76\\u524d\\u5f80/u,
        /\\u786e\\u8ba4\\u6388\\u6743/u,
        /confirm\\s*(authorization|auth)/i,
        /authorize\\s*(and\\s*)?(go|continue|enter)/i
      ];
      const loginAgreementConfirmHintPatterns = [
        /\\u540c\\u610f\\u5e76\\u767b\\u5f55/u,
        /\\u540c\\u610f.*\\u767b\\u5f55/u,
        /agree\\s*(and\\s*)?(log\\s*in|login|sign\\s*in)/i
      ];
      const agreementHintPatterns = [
        ...authorizationAgreementHintPatterns,
        /\\u6211\\u5df2\\u9605\\u8bfb\\u5e76\\u540c\\u610f/u,
        /\\u9605\\u8bfb\\u5e76\\u540c\\u610f/u,
        /\\u9690\\u79c1\\u653f\\u7b56/u,
        /\\u8d26\\u53f7\\u4f7f\\u7528\\u987b\\u77e5/u,
        /privacy\\s*policy/i,
        /terms/i
      ];
      const agreementCheckedStatePatterns = [
        /\\bchecked\\b/i,
        /\\bselected\\b/i,
        /\\bactive\\b/i,
        /\\bon\\b/i,
        /\\bis-checked\\b/i,
        /\\bcheckbox-checked\\b/i,
        /haschecksquare/i
      ];
      const agreementUncheckedStatePatterns = [
        /\\bunchecked\\b/i,
        /\\boff\\b/i,
        /\\bdisabled\\b/i,
        /\\bis-unchecked\\b/i
      ];
      const loginModeSwitchPathPatterns = [
        /^\\/login$/i,
        /^\\/settle\\/activity-login$/i
      ];
      const runningStateKey = '__TEMU_TOOLBOX_LOGIN_AUTOFILL__';
      const authorizationAgreementStateKey = '__TEMU_TOOLBOX_LOGIN_AUTHORIZATION_AGREEMENT__';
      const submitPreparationKey = '__TEMU_TOOLBOX_LOGIN_SUBMIT_PREPARATION__';
      const submitGuardMemoryKey = '__TEMU_TOOLBOX_LOGIN_SUBMIT_GUARD__';
      const submitGuardStorageKey = 'temu_toolbox_login_submit_guard_v1';
      const submitWarmupMs = 1200;
      const submitCooldownMs = 18000;
      const agreementWarmupMs = 220;
      const activityHomeRequiredPatterns = [
        /\\u8bf7\\u8bbf\\u95ee\\u6d3b\\u52a8\\u4e3b\\u9875\\u64cd\\u4f5c\\u767b\\u5f55/u,
        /\\u6d3b\\u52a8\\u4e3b\\u9875.*\\u767b\\u5f55/u,
        /visit\\s+the\\s+activity\\s+homepage.*login/i
      ];

      function normalizeText(value) {
        return String(value || '').trim();
      }

      function normalizeAccountValue(value) {
        return String(value || '').replace(/[\\s\\u200B-\\u200D\\uFEFF]+/g, '');
      }

      function normalizeDigits(value) {
        return normalizeText(value).replace(/\\D+/g, '');
      }

      function isEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeAccountValue(value));
      }

      function limitText(value, maxLength) {
        const normalizedValue = normalizeText(value);
        const limit = Number(maxLength) || 0;

        if (!normalizedValue || limit <= 0 || normalizedValue.length <= limit) {
          return normalizedValue;
        }

        return normalizedValue.slice(0, limit);
      }

      function maskText(value, visibleTailLength) {
        const normalizedValue = normalizeText(value);
        const tailLength = Math.max(0, Number(visibleTailLength) || 0);

        if (!normalizedValue) {
          return '';
        }

        if (normalizedValue.length <= tailLength) {
          return normalizedValue;
        }

        return '*'.repeat(Math.max(0, normalizedValue.length - tailLength)) + normalizedValue.slice(-tailLength);
      }

      function matchesAnyPattern(text, patterns) {
        return patterns.some((pattern) => pattern.test(text));
      }

      function countMatchingPatterns(text, patterns) {
        return patterns.reduce((count, pattern) => (
          count + (pattern.test(text) ? 1 : 0)
        ), 0);
      }

      function resolveAuthIdentity(authConfig) {
        const source = authConfig && typeof authConfig === 'object' ? authConfig : {};
        const explicitAccountType = normalizeText(source.accountType).toLowerCase();
        const phoneNumber = normalizeAccountValue(source.phoneNumber);
        const email = normalizeAccountValue(source.email);
        const accountValue = normalizeAccountValue(
          Object.prototype.hasOwnProperty.call(source, 'accountValue')
            ? source.accountValue
            : (email || phoneNumber)
        );

        if (explicitAccountType === 'email') {
          const explicitEmail = email || accountValue || phoneNumber;

          if (explicitEmail) {
            return {
              phoneNumber: '',
              email: explicitEmail,
              accountValue: explicitEmail,
              accountType: 'email'
            };
          }
        }

        if (explicitAccountType === 'phone') {
          const explicitPhoneNumber = phoneNumber || accountValue || email;

          if (explicitPhoneNumber) {
            return {
              phoneNumber: explicitPhoneNumber,
              email: '',
              accountValue: explicitPhoneNumber,
              accountType: 'phone'
            };
          }
        }

        const emailCandidate = [email, accountValue, phoneNumber]
          .find((value) => isEmail(value)) || '';

        if (emailCandidate) {
          return {
            phoneNumber: '',
            email: emailCandidate,
            accountValue: emailCandidate,
            accountType: 'email'
          };
        }

        const resolvedPhoneNumber = phoneNumber || accountValue;

        return {
          phoneNumber: resolvedPhoneNumber,
          email: '',
          accountValue: resolvedPhoneNumber,
          accountType: resolvedPhoneNumber ? 'phone' : ''
        };
      }

      function hasCompleteAuthConfig(authConfig) {
        const accountIdentity = resolveAuthIdentity(authConfig);

        return Boolean(
          authConfig
          && accountIdentity.accountValue
          && normalizeText(authConfig.loginPassword)
        );
      }

      function normalizeAuthConfig(authConfig) {
        const accountIdentity = resolveAuthIdentity(authConfig);

        return {
          phoneNumber: accountIdentity.phoneNumber,
          email: accountIdentity.email,
          accountValue: accountIdentity.accountValue,
          accountType: accountIdentity.accountType,
          loginPassword: normalizeText(authConfig && authConfig.loginPassword)
        };
      }

      function canReuseSavedPassword(runtimeAuthConfig, savedAuthConfig) {
        const runtimeIdentity = resolveAuthIdentity(runtimeAuthConfig);
        const savedIdentity = resolveAuthIdentity(savedAuthConfig);

        if (!runtimeIdentity.accountValue || !savedIdentity.accountValue) {
          return false;
        }

        if (
          runtimeIdentity.accountType
          && savedIdentity.accountType
          && runtimeIdentity.accountType !== savedIdentity.accountType
        ) {
          return false;
        }

        if (runtimeIdentity.accountType === 'email' || savedIdentity.accountType === 'email') {
          return runtimeIdentity.accountValue.toLowerCase() === savedIdentity.accountValue.toLowerCase();
        }

        return runtimeIdentity.accountValue === savedIdentity.accountValue;
      }

      function readSavedAuthConfig() {
        try {
          return normalizeAuthConfig(JSON.parse(window.localStorage.getItem(storageKey) || '{}'));
        } catch (_error) {
          return normalizeAuthConfig(null);
        }
      }

      function resolveEffectiveAuthConfig() {
        const normalizedRuntimeAuthConfig = normalizeAuthConfig(runtimeAuthConfig);
        const savedAuthConfig = readSavedAuthConfig();
        const runtimeAccountIdentity = resolveAuthIdentity(normalizedRuntimeAuthConfig);
        const savedAccountIdentity = resolveAuthIdentity(savedAuthConfig);

        if (hasCompleteAuthConfig(normalizedRuntimeAuthConfig)) {
          return {
            ...normalizedRuntimeAuthConfig,
            authConfigSource: 'runtime'
          };
        }

        if (
          normalizedRuntimeAuthConfig.accountValue
          || normalizedRuntimeAuthConfig.phoneNumber
          || normalizedRuntimeAuthConfig.email
          || normalizedRuntimeAuthConfig.loginPassword
        ) {
          const runtimeAccountValue =
            runtimeAccountIdentity.accountValue
            || normalizedRuntimeAuthConfig.accountValue
            || normalizedRuntimeAuthConfig.email
            || normalizedRuntimeAuthConfig.phoneNumber;
          const shouldReuseSavedPassword = canReuseSavedPassword(
            normalizedRuntimeAuthConfig,
            savedAuthConfig
          );
          const mergedAuthConfig = normalizeAuthConfig({
            phoneNumber: runtimeAccountIdentity.phoneNumber,
            email: runtimeAccountIdentity.email,
            accountValue: runtimeAccountValue,
            accountType: runtimeAccountIdentity.accountType,
            loginPassword:
              normalizedRuntimeAuthConfig.loginPassword
              || (shouldReuseSavedPassword ? savedAuthConfig.loginPassword : '')
          });

          return {
            ...mergedAuthConfig,
            authConfigSource: shouldReuseSavedPassword ? 'runtime+saved-password' : 'runtime-partial'
          };
        }

        if (hasCompleteAuthConfig(savedAuthConfig)) {
          return {
            ...savedAuthConfig,
            authConfigSource: 'saved'
          };
        }

        return {
          ...normalizeAuthConfig(null),
          authConfigSource: ''
        };
      }

      function writeSavedAuthConfig(authConfig) {
        const normalizedAuthConfig = normalizeAuthConfig(authConfig);

        if (!hasCompleteAuthConfig(normalizedAuthConfig)) {
          return;
        }

        try {
          window.localStorage.setItem(storageKey, JSON.stringify(normalizedAuthConfig));
        } catch (_error) {
          // Ignore storage failures.
        }
      }

      function ensureSubmitPreparationState() {
        const currentUrl = normalizeText(window.location.href);

        if (!window[submitPreparationKey] || typeof window[submitPreparationKey] !== 'object') {
          window[submitPreparationKey] = {};
        }

        const state = window[submitPreparationKey];

        if (normalizeText(state.url) !== currentUrl) {
          state.url = currentUrl;
          state.fingerprint = '';
          state.passwordTouchedFingerprint = '';
          state.lastInteractionAt = 0;
        }

        return state;
      }

      function buildSubmitPreparationFingerprint(accountValue, passwordValue) {
        return [
          isEmail(normalizeText(accountValue))
            ? normalizeText(accountValue).toLowerCase()
            : normalizeDigits(accountValue),
          normalizeText(passwordValue)
        ].join('::');
      }

      function isActivityLoginPage() {
        const pathname = normalizeText(window.location && window.location.pathname).toLowerCase();
        return pathname === '/settle/activity-login';
      }

      function normalizeSubmitGuardState(state) {
        return {
          url: normalizeText(state && state.url),
          fingerprint: normalizeText(state && state.fingerprint),
          lastSubmittedAt: Number(state && state.lastSubmittedAt) || 0
        };
      }

      function readSubmitGuardState() {
        if (window[submitGuardMemoryKey] && typeof window[submitGuardMemoryKey] === 'object') {
          return normalizeSubmitGuardState(window[submitGuardMemoryKey]);
        }

        try {
          return normalizeSubmitGuardState(JSON.parse(window.sessionStorage.getItem(submitGuardStorageKey) || '{}'));
        } catch (_error) {
          return normalizeSubmitGuardState(null);
        }
      }

      function writeSubmitGuardState(nextState) {
        const normalizedState = normalizeSubmitGuardState(nextState);
        window[submitGuardMemoryKey] = normalizedState;

        try {
          window.sessionStorage.setItem(submitGuardStorageKey, JSON.stringify(normalizedState));
        } catch (_error) {
          // Ignore session storage failures.
        }

        return normalizedState;
      }

      function ensureSubmitGuardState() {
        const currentUrl = normalizeText(window.location.href);
        const state = readSubmitGuardState();

        if (state.url !== currentUrl) {
          return writeSubmitGuardState({
            url: currentUrl,
            fingerprint: '',
            lastSubmittedAt: 0
          });
        }

        return state;
      }

      function buildSubmitGuardFingerprint(accountInput, passwordInput) {
        const accountMode = isLikelyEmailOrAccountInput(accountInput) && !isLikelyPhoneAccountInput(accountInput)
          ? 'text'
          : 'digits';

        return buildSubmitPreparationFingerprint(
          getInputComparableValue(accountInput, accountMode),
          getInputComparableValue(passwordInput, 'text')
        );
      }

      function getActiveSubmitGuard(accountInput, passwordInput) {
        const fingerprint = buildSubmitGuardFingerprint(accountInput, passwordInput);

        if (!fingerprint) {
          return {
            active: false,
            remainingMs: 0
          };
        }

        const state = ensureSubmitGuardState();

        if (state.fingerprint !== fingerprint || state.lastSubmittedAt <= 0) {
          return {
            active: false,
            remainingMs: 0
          };
        }

        const remainingMs = Math.max(0, submitCooldownMs - (Date.now() - state.lastSubmittedAt));

        return {
          active: remainingMs > 0,
          remainingMs
        };
      }

      function markSubmitGuardSubmitted(accountInput, passwordInput) {
        writeSubmitGuardState({
          url: normalizeText(window.location.href),
          fingerprint: buildSubmitGuardFingerprint(accountInput, passwordInput),
          lastSubmittedAt: Date.now()
        });
      }

      function ensureAuthorizationAgreementState() {
        if (!window[authorizationAgreementStateKey] || typeof window[authorizationAgreementStateKey] !== 'object') {
          window[authorizationAgreementStateKey] = {};
        }

        return window[authorizationAgreementStateKey];
      }

      function buildAuthorizationAgreementSignature() {
        return [
          normalizeText(window.location && window.location.origin),
          normalizeText(window.location && window.location.pathname),
          limitText(normalizeText(document.body && document.body.innerText), 260)
        ]
          .filter(Boolean)
          .join('::');
      }

      function shouldThrottleAuthorizationAgreementClick() {
        const state = ensureAuthorizationAgreementState();

        return Boolean(
          normalizeText(state.signature) === buildAuthorizationAgreementSignature()
          && Date.now() - (Number(state.lastClickAt) || 0) < 2400
        );
      }

      function markAuthorizationAgreementClicked() {
        const state = ensureAuthorizationAgreementState();

        state.signature = buildAuthorizationAgreementSignature();
        state.lastClickAt = Date.now();
      }

      function collectVisibleNoticeText() {
        const selectors = [
          '[role="alert"]',
          '[aria-live]',
          '[class*="toast"]',
          '[class*="message"]',
          '[class*="notice"]',
          '[class*="alert"]',
          '[class*="tips"]',
          '[class*="tip"]',
          '[data-testid*="toast"]',
          '[data-testid*="message"]'
        ].join(', ');
        const seenText = new Set();

        return Array.from(document.querySelectorAll(selectors))
          .filter((element) => isVisible(element))
          .map((element) => (
            [
              normalizeText(element.textContent),
              normalizeText(element.getAttribute('aria-label')),
              normalizeText(element.getAttribute('title'))
            ]
              .filter(Boolean)
              .join(' ')
          ))
          .filter((text) => {
            const normalizedValue = normalizeText(text);

            if (!normalizedValue || seenText.has(normalizedValue)) {
              return false;
            }

            seenText.add(normalizedValue);
            return true;
          });
      }

      function findActivityHomeRequiredMessage() {
        if (!isActivityLoginPage()) {
          return '';
        }

        const candidateTexts = [
          normalizeText(document.body && document.body.innerText),
          ...collectVisibleNoticeText()
        ];

        for (const text of candidateTexts) {
          const normalizedValue = normalizeText(text);

          if (!normalizedValue) {
            continue;
          }

          if (matchesAnyPattern(normalizedValue.toLowerCase(), activityHomeRequiredPatterns)) {
            return limitText(normalizedValue, 160);
          }
        }

        return '';
      }

      function isVisible(element) {
        if (!(element instanceof HTMLElement)) {
          return false;
        }

        if (element.hidden || element.hasAttribute('hidden')) {
          return false;
        }

        const style = window.getComputedStyle(element);

        if (!style || style.display === 'none' || style.visibility === 'hidden') {
          return false;
        }

        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function getHintText(element) {
        if (!(element instanceof HTMLElement)) {
          return '';
        }

        const labelText = element.labels
          ? Array.from(element.labels).map((label) => normalizeText(label && label.textContent)).join(' ')
          : '';

        return [
          normalizeText(element.textContent),
          normalizeText(element.value),
          normalizeText(element.placeholder),
          normalizeText(element.getAttribute('aria-label')),
          normalizeText(element.getAttribute('title')),
          normalizeText(element.getAttribute('autocomplete')),
          normalizeText(element.getAttribute('data-testid')),
          normalizeText(element.id),
          normalizeText(element.name),
          normalizeText(element.className),
          labelText
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
      }

      function collectVisibleInputs() {
        return Array.from(document.querySelectorAll('input'))
          .filter((input) => isVisible(input));
      }

      function hasVisibleAgreementLoginSubmitButton() {
        return Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]'))
          .filter((element) => isVisible(element))
          .some((element) => {
            const hintText = getHintText(element);

            return (
              matchesAnyPattern(hintText, authorizationConfirmHintPatterns)
              || hintText.includes('\\u6388\\u6743\\u767b\\u5f55')
              || hintText.includes('\\u767b\\u5f55')
              || /authorize\\s*(login|sign\\s*in)/i.test(hintText)
              || /\\blog\\s*in\\b/i.test(hintText)
              || /sign\\s*in/i.test(hintText)
            );
          });
      }

      function isAgreementGatedLoginPage() {
        const bodyText = limitText(normalizeText(document.body && document.body.innerText), 1600);

        return Boolean(
          bodyText
          && hasVisibleAgreementLoginSubmitButton()
          && matchesAnyPattern(bodyText, agreementHintPatterns)
        );
      }

      function isLoginModeSwitchPage() {
        const pathname = normalizeText(window.location && window.location.pathname).toLowerCase();
        return loginModeSwitchPathPatterns.some((pattern) => pattern.test(pathname));
      }

      function getLoginModeHintText(element) {
        if (!(element instanceof HTMLElement)) {
          return '';
        }

        return [
          normalizeText(element.textContent),
          normalizeText(element.getAttribute('aria-label')),
          normalizeText(element.getAttribute('title')),
          normalizeText(element.getAttribute('data-testid')),
          normalizeText(element.getAttribute('role')),
          normalizeText(element.className),
          normalizeText(element.id)
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
      }

      function resolveLoginModeClickableTarget(element) {
        if (!(element instanceof HTMLElement)) {
          return null;
        }

        return (
          element.closest('button, [role="tab"], [role="button"], [aria-selected], [aria-pressed], a, label')
          || element
        );
      }

      function hasSelectedLoginModeState(element) {
        if (!(element instanceof HTMLElement)) {
          return false;
        }

        const ariaSelected = normalizeText(element.getAttribute('aria-selected')).toLowerCase();
        const ariaCurrent = normalizeText(element.getAttribute('aria-current')).toLowerCase();
        const ariaPressed = normalizeText(element.getAttribute('aria-pressed')).toLowerCase();
        const stateText = [
          normalizeText(element.className),
          normalizeText(element.id),
          normalizeText(element.getAttribute('data-state')),
          normalizeText(element.getAttribute('data-status'))
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return (
          ariaSelected === 'true'
          || ariaCurrent === 'page'
          || ariaPressed === 'true'
          || /\b(active|current|selected|checked|is-active|is-current|tab-active)\b/i.test(stateText)
        );
      }

      function collectLoginModeCandidates() {
        const selector = [
          'button',
          '[role="tab"]',
          '[role="button"]',
          '[aria-selected]',
          '[aria-pressed]',
          'a',
          'label',
          'div',
          'span'
        ].join(', ');
        const seen = new Set();

        return Array.from(document.querySelectorAll(selector))
          .map((element) => resolveLoginModeClickableTarget(element))
          .filter((element) => {
            if (!(element instanceof HTMLElement) || seen.has(element) || !isVisible(element)) {
              return false;
            }

            seen.add(element);
            const rect = element.getBoundingClientRect();

            if (rect.width <= 40 || rect.height <= 18 || rect.height >= 140) {
              return false;
            }

            if (rect.width >= Math.max(window.innerWidth * 0.95, 720) && rect.height >= 80) {
              return false;
            }

            const hintText = getLoginModeHintText(element);

            if (!hintText || hintText.length > 160) {
              return false;
            }

            return (
              matchesAnyPattern(hintText, accountLoginModeHintPatterns)
              || matchesAnyPattern(hintText, otpLoginModeHintPatterns)
              || matchesAnyPattern(hintText, scanLoginModeHintPatterns)
            );
          })
          .map((element) => {
            const hintText = getLoginModeHintText(element);
            const role = normalizeText(element.getAttribute('role')).toLowerCase();
            const accountMatches = countMatchingPatterns(hintText, accountLoginModeHintPatterns);
            const otpMatches = countMatchingPatterns(hintText, otpLoginModeHintPatterns);
            const scanMatches = countMatchingPatterns(hintText, scanLoginModeHintPatterns);
            const compactHintText = hintText.replace(/\\s+/g, '');
            const classStateText = String(element.className || '') + ' ' + String(element.id || '');
            let score = 0;

            if (accountMatches > 0) {
              score += 180;
            }

            if (otpMatches > 0) {
              score -= 140;
            }

            if (scanMatches > 0) {
              score -= 180;
            }

            if (accountMatches > 0 && (otpMatches > 0 || scanMatches > 0)) {
              score -= 220;
            }

            if (
              accountMatches > 0
              && /^(accountpasswordlogin|accountlogin|passwordlogin|\\u8d26\\u53f7\\u5bc6\\u7801\\u767b\\u5f55|\\u8d26\\u53f7\\u767b\\u5f55|\\u5bc6\\u7801\\u767b\\u5f55)$/.test(compactHintText)
            ) {
              score += 140;
            }

            if (role === 'tab') {
              score += 40;
            } else if (role === 'button') {
              score += 24;
            }

            if (normalizeText(element.tagName).toLowerCase() === 'button') {
              score += 20;
            }

            if (/[._-](tab|switch|toggle|mode|card|segment|header)/i.test(classStateText)) {
              score += 18;
            }

            if (/tabitem/i.test(classStateText)) {
              score += 80;
            }

            if (/taboperate|logintab|commontab/i.test(classStateText)) {
              score -= 36;
            }

            if (hintText.length <= 28) {
              score += 24;
            } else if (hintText.length >= 56) {
              score -= 24;
            }

            if (element.childElementCount <= 2) {
              score += 14;
            } else if (element.childElementCount >= 4) {
              score -= 18;
            }

            if (hasSelectedLoginModeState(element)) {
              score += 16;
            }

            return {
              element,
              hintText,
              score,
              selected: hasSelectedLoginModeState(element)
            };
          })
          .filter((entry) => entry.score > 0)
          .sort((left, right) => right.score - left.score);
      }

      function getLoginModeDiagnostics() {
        const candidates = collectLoginModeCandidates()
          .slice(0, 6)
          .map((entry) => ({
            tagName: normalizeText(entry.element && entry.element.tagName).toLowerCase(),
            text: limitText(entry.hintText, 80),
            selected: entry.selected === true
          }));
        const selectedCandidate = candidates.find((candidate) => candidate.selected);

        return {
          switchRequired: isLoginModeSwitchPage(),
          candidateCount: candidates.length,
          selectedText: selectedCandidate ? selectedCandidate.text : '',
          candidates
        };
      }

      function isEmailLoginModeCandidate(entry) {
        const hintText = normalizeText(entry && entry.hintText);

        return Boolean(
          hintText
          && (
            /\u90AE\u7BB1(\u8d26\u53f7)?\u767B\u5F55/u.test(hintText)
            || /email(\s*account)?\s*login/i.test(hintText)
            || /\bemail\b/i.test(hintText)
          )
        );
      }

      function isOtpLoginModeCandidate(entry) {
        return matchesAnyPattern(normalizeText(entry && entry.hintText), otpLoginModeHintPatterns);
      }

      function isScanLoginModeCandidate(entry) {
        return matchesAnyPattern(normalizeText(entry && entry.hintText), scanLoginModeHintPatterns);
      }

      function isAccountLoginModeCandidate(entry) {
        return (
          matchesAnyPattern(normalizeText(entry && entry.hintText), accountLoginModeHintPatterns)
          && !isOtpLoginModeCandidate(entry)
          && !isScanLoginModeCandidate(entry)
        );
      }

      function getSelectedLoginModeCandidate(loginModeCandidates) {
        const candidates =
          Array.isArray(loginModeCandidates) && loginModeCandidates.length > 0
            ? loginModeCandidates
            : collectLoginModeCandidates();

        return candidates.find((entry) => entry && entry.selected === true) || null;
      }

      function isLikelyPhoneAccountInput(accountInput) {
        if (!(accountInput instanceof HTMLInputElement)) {
          return false;
        }

        const hintText = getHintText(accountInput);
        const inputType = normalizeText(accountInput.type).toLowerCase();
        const inputMode = normalizeText(accountInput.inputMode).toLowerCase();
        const autocomplete = normalizeText(accountInput.autocomplete).toLowerCase();

        return Boolean(
          /phone|mobile|\u624b\u673a/u.test(hintText)
          || matchesAnyPattern(hintText, hongKongPatterns)
          || matchesAnyPattern(hintText, mainlandPatterns)
          || /area\s*code|prefix|\u533a\u53f7/u.test(hintText)
          || inputType === 'tel'
          || inputMode === 'numeric'
          || autocomplete.includes('tel')
        );
      }

      function isLikelyEmailOrAccountInput(accountInput) {
        if (!(accountInput instanceof HTMLInputElement)) {
          return false;
        }

        const hintText = getHintText(accountInput);
        const inputType = normalizeText(accountInput.type).toLowerCase();
        const inputMode = normalizeText(accountInput.inputMode).toLowerCase();
        const autocomplete = normalizeText(accountInput.autocomplete).toLowerCase();

        return Boolean(
          /email|mail|\u90ae\u7bb1/u.test(hintText)
          || /account|username|\u8d26\u53f7/u.test(hintText)
          || inputType === 'email'
          || inputMode === 'email'
          || autocomplete.includes('email')
        );
      }

      function hasVisibleSellerEmailCredentials() {
        const passwordInput = findPasswordInput();
        const accountInput = findAccountInput(passwordInput, {
          targetMode: 'email'
        });
        const regionDisplayInput = findRegionDisplayInput(findRegionRoot());

        return Boolean(
          passwordInput
          && accountInput
          && isVisible(passwordInput)
          && isVisible(accountInput)
          && !isLikelyPhoneAccountInput(accountInput)
          && !(regionDisplayInput && isVisible(regionDisplayInput))
          && (
            normalizeText(accountInput.id) === 'userEmailId'
            || isLikelyEmailOrAccountInput(accountInput)
          )
        );
      }

      function isEmailLoginModeReady(loginModeCandidates) {
        const candidates =
          Array.isArray(loginModeCandidates) && loginModeCandidates.length > 0
            ? loginModeCandidates
            : collectLoginModeCandidates();
        const passwordInput = findPasswordInput();
        const accountInput = findAccountInput(passwordInput, {
          targetMode: 'email'
        });

        if (hasVisibleSellerEmailCredentials()) {
          return true;
        }

        const selectedCandidate = getSelectedLoginModeCandidate(candidates);
        const regionDisplayInput = findRegionDisplayInput(findRegionRoot());
        const hasSwitchCandidates = candidates.some((entry) => (
          isEmailLoginModeCandidate(entry) || isAccountLoginModeCandidate(entry)
        ));

        if (!(passwordInput && accountInput)) {
          return false;
        }

        if (selectedCandidate && (isOtpLoginModeCandidate(selectedCandidate) || isScanLoginModeCandidate(selectedCandidate))) {
          return false;
        }

        if (isLikelyPhoneAccountInput(accountInput)) {
          return false;
        }

        if (regionDisplayInput && isVisible(regionDisplayInput)) {
          return false;
        }

        if (hasSwitchCandidates && !selectedCandidate) {
          return false;
        }

        if (selectedCandidate && isEmailLoginModeCandidate(selectedCandidate)) {
          return true;
        }

        if (selectedCandidate && isAccountLoginModeCandidate(selectedCandidate)) {
          return false;
        }

        return !hasSwitchCandidates && isLikelyEmailOrAccountInput(accountInput);
      }

      function hasCredentialInputsVisible() {
        const passwordInput = findPasswordInput();
        const accountInput = findAccountInput(passwordInput);
        return Boolean(passwordInput && accountInput);
      }

      function ensureAccountLoginMode(targetMode) {
        if (!isLoginModeSwitchPage()) {
          return {
            ready: true,
            status: 'not-required'
          };
        }

        const loginModeCandidates = collectLoginModeCandidates();

        if (targetMode === 'email') {
          if (hasVisibleSellerEmailCredentials()) {
            return {
              ready: true,
              status: 'email-mode-ready'
            };
          }

          const emailCandidate = loginModeCandidates.find((entry) => isEmailLoginModeCandidate(entry));

          if (isEmailLoginModeReady(loginModeCandidates)) {
            return {
              ready: true,
              status: 'email-mode-ready'
            };
          }

          if (emailCandidate) {
            if (emailCandidate.selected === true) {
              return {
                ready: false,
                status: 'email-mode-waiting',
                diagnostics: getLoginModeDiagnostics()
              };
            }

            triggerPointerClick(emailCandidate.element);

            return {
              ready: false,
              status: 'email-switch-clicked',
              diagnostics: getLoginModeDiagnostics()
            };
          }

          return {
            ready: false,
            status: 'missing-email-login-mode',
            diagnostics: getLoginModeDiagnostics()
          };
        }

        if (targetMode !== 'email' && hasCredentialInputsVisible()) {
          return {
            ready: true,
            status: 'credentials-visible'
          };
        }

        const accountCandidate = loginModeCandidates.find((entry) => isAccountLoginModeCandidate(entry))
          || loginModeCandidates.find((entry) => matchesAnyPattern(entry.hintText, accountLoginModeHintPatterns));

        if (!accountCandidate) {
          return {
            ready: false,
            status: 'missing-switcher',
            diagnostics: getLoginModeDiagnostics()
          };
        }

        if (accountCandidate.selected === true) {
          if (targetMode === 'email') {
            const ready = isEmailLoginModeReady(loginModeCandidates);
            return {
              ready,
              status: ready ? 'email-mode-ready' : 'account-mode-waiting',
              diagnostics: getLoginModeDiagnostics()
            };
          }

          return {
            ready: hasCredentialInputsVisible(),
            status: hasCredentialInputsVisible() ? 'account-mode-ready' : 'account-mode-waiting',
            diagnostics: getLoginModeDiagnostics()
          };
        }

        triggerPointerClick(accountCandidate.element);

        return {
          ready: false,
          status: 'switch-clicked',
          diagnostics: getLoginModeDiagnostics()
        };
      }

      function isEditableInput(input) {
        return Boolean(
          input
          && input instanceof HTMLInputElement
          && input.disabled !== true
          && input.readOnly !== true
        );
      }

      function describeElement(element, options) {
        const settings = options && typeof options === 'object' ? options : {};
        const value = normalizeText(element && 'value' in element ? element.value : '');
        const rect = element instanceof HTMLElement ? element.getBoundingClientRect() : null;

        return {
          tagName: normalizeText(element && element.tagName).toLowerCase(),
          id: normalizeText(element && element.id),
          name: normalizeText(element && element.name),
          type: normalizeText(element && element.type).toLowerCase(),
          inputMode: normalizeText(element && element.inputMode).toLowerCase(),
          placeholder: normalizeText(element && element.placeholder),
          className: limitText(normalizeText(element && element.className), 160),
          disabled: Boolean(element && element.disabled === true),
          readOnly: Boolean(element && element.readOnly === true),
          maxLength: Number(element && element.maxLength) > 0 ? Number(element.maxLength) : 0,
          width: rect ? Math.round(rect.width) : 0,
          valueLength: value.length,
          valuePreview: settings.mask === false ? limitText(value, 32) : maskText(value, settings.visibleTailLength)
        };
      }

      function getComparableValue(value, mode) {
        if (mode === 'digits') {
          return normalizeDigits(value);
        }

        return normalizeText(value);
      }

      function getInputComparableValue(input, mode) {
        if (!input) {
          return '';
        }

        return getComparableValue(input.value, mode);
      }

      function findRegionBindingRoot() {
        return document.getElementById('usernameId');
      }

      function getAccountBindingRoots() {
        const roots = [
          document.getElementById('userEmailId'),
          document.getElementById('usernameId')
        ]
          .filter((element, index, array) => (
            element instanceof HTMLElement
            && array.indexOf(element) === index
          ));

        return roots;
      }

      function getReactPropCandidates(element) {
        if (!(element instanceof HTMLElement)) {
          return [];
        }

        const candidates = [];
        const seen = new Set();

        Object.keys(element).forEach((key) => {
          if (key.startsWith('__reactProps$')) {
            const props = element[key];

            if (props && !seen.has(props)) {
              seen.add(props);
              candidates.push(props);
            }
          }
        });

        Object.keys(element).forEach((key) => {
          if (!key.startsWith('__reactFiber$')) {
            return;
          }

          let fiber = element[key];
          let depth = 0;

          while (fiber && depth < 12) {
            const props = fiber.memoizedProps;

            if (props && !seen.has(props)) {
              seen.add(props);
              candidates.push(props);
            }

            fiber = fiber.return;
            depth += 1;
          }
        });

        return candidates;
      }

      function findReactBinding(element, predicate) {
        let currentElement = element instanceof HTMLElement ? element : null;

        while (currentElement) {
          const candidates = getReactPropCandidates(currentElement);

          for (const props of candidates) {
            if (!predicate || predicate(props, currentElement)) {
              return {
                element: currentElement,
                props
              };
            }
          }

          currentElement = currentElement.parentElement;
        }

        return null;
      }

      function findAccountReactBinding() {
        const bindingRoots = getAccountBindingRoots();

        for (const rootElement of bindingRoots) {
          const binding = findReactBinding(rootElement, (props) => {
            if (!props || typeof props.onChange !== 'function') {
              return false;
            }

            const propId = normalizeText(props.id);
            const currentValue = props.value;
            const isStructuredValue = Boolean(
              currentValue
              && typeof currentValue === 'object'
              && (
                Object.prototype.hasOwnProperty.call(currentValue, 'phone')
                || Object.prototype.hasOwnProperty.call(currentValue, 'areaCode')
                || Object.prototype.hasOwnProperty.call(currentValue, 'email')
              )
            );
            const isEmailStringValue = propId === 'userEmailId' && typeof currentValue === 'string';

            if (!(propId === 'usernameId' || propId === 'userEmailId')) {
              return false;
            }

            return isStructuredValue || isEmailStringValue;
          });

          if (binding) {
            return binding;
          }
        }

        return null;
      }

      function findPasswordReactBinding() {
        return findReactBinding(document.getElementById('passwordId'), (props) => (
          props
          && typeof props.onChange === 'function'
          && normalizeText(props.id) === 'passwordId'
          && typeof props.value === 'string'
          && (
            Object.prototype.hasOwnProperty.call(props, 'customNode')
            || Object.prototype.hasOwnProperty.call(props, 'prefix')
            || normalizeText(props.type).toLowerCase() === 'password'
          )
        ));
      }

      function getAccountReactState() {
        const binding = findAccountReactBinding();
        const rawValue = binding && binding.props ? binding.props.value : null;
        const value = rawValue && typeof rawValue === 'object'
          ? rawValue
          : null;
        const stringEmailValue = typeof rawValue === 'string'
          ? rawValue
          : '';
        const hasPhoneField = Boolean(
          value
          && typeof value === 'object'
          && Object.prototype.hasOwnProperty.call(value, 'phone')
        );
        const hasAreaCodeField = Boolean(
          value
          && typeof value === 'object'
          && Object.prototype.hasOwnProperty.call(value, 'areaCode')
        );
        const hasEmailField = Boolean(
          value
          && typeof value === 'object'
          && Object.prototype.hasOwnProperty.call(value, 'email')
        );

        return {
          bindingFound: Boolean(binding),
          phone: normalizeText(value && value.phone),
          areaCode: normalizeText(value && value.areaCode),
          email: normalizeText((value && value.email) || stringEmailValue),
          bindingMode: typeof rawValue === 'string' ? 'email-string' : (value ? 'structured' : ''),
          hasPhoneField,
          hasAreaCodeField,
          hasEmailField: hasEmailField || Boolean(stringEmailValue)
        };
      }

      function getPasswordReactState() {
        const binding = findPasswordReactBinding();
        return {
          bindingFound: Boolean(binding),
          value: normalizeText(binding && binding.props ? binding.props.value : '')
        };
      }

      function findScopedInput(rootId, scorer) {
        const rootElement = document.getElementById(rootId);

        if (!rootElement) {
          return null;
        }

        const candidates = [
          ...(rootElement instanceof HTMLInputElement ? [rootElement] : []),
          ...Array.from(rootElement.querySelectorAll('input'))
        ]
          .filter((input) => input instanceof HTMLInputElement)
          .map((input) => ({
            input,
            score: scorer(input)
          }))
          .filter((entry) => entry.score > 0)
          .sort((left, right) => right.score - left.score);

        return candidates.length > 0 ? candidates[0].input : null;
      }

      function findPasswordInput() {
        const sellerPasswordInput = findScopedInput('passwordId', (input) => {
          const hintText = getHintText(input);
          const rect = input.getBoundingClientRect();
          let score = 0;

          if (!isEditableInput(input)) {
            return -1;
          }

          if (normalizeText(input.type).toLowerCase() === 'password') {
            score += 120;
          }

          if (matchesAnyPattern(hintText, passwordHintPatterns)) {
            score += 80;
          }

          if (normalizeText(input.id) === 'passwordId') {
            score += 60;
          }

          if (rect.width >= 200) {
            score += 30;
          }

          if (isVisible(input)) {
            score += 40;
          }

          return score;
        });

        if (sellerPasswordInput) {
          return sellerPasswordInput;
        }

        const candidates = collectVisibleInputs()
          .map((input) => {
            const hintText = getHintText(input);
            const rect = input.getBoundingClientRect();
            let score = 0;

            if (!isEditableInput(input)) {
              return {
                input,
                score: -1
              };
            }

            if (normalizeText(input.type).toLowerCase() === 'password') {
              score += 120;
            }

            if (matchesAnyPattern(hintText, passwordHintPatterns)) {
              score += 80;
            }

            if (matchesAnyPattern(hintText, otpHintPatterns)) {
              score -= 120;
            }

            if (rect.width >= 200) {
              score += 30;
            }

            return {
              input,
              score
            };
          })
          .filter((entry) => entry.score > 0)
          .sort((left, right) => right.score - left.score);

        return candidates.length > 0 ? candidates[0].input : null;
      }

      function findAccountInput(passwordInput, options) {
        const normalizedOptions = options && typeof options === 'object' ? options : {};
        const targetMode = normalizeText(normalizedOptions.targetMode).toLowerCase();
        const preferEmailMode = targetMode === 'email';

        if (preferEmailMode) {
          const directEmailInput = document.getElementById('userEmailId');

          if (isEditableInput(directEmailInput) && isVisible(directEmailInput)) {
            return directEmailInput;
          }
        }

        const sellerAccountInput = findScopedInput('usernameId', (input) => {
          const inputType = normalizeText(input.type).toLowerCase();
          const autocomplete = normalizeText(input.autocomplete).toLowerCase();
          const inputMode = normalizeText(input.inputMode).toLowerCase();
          const hintText = getHintText(input);
          const rect = input.getBoundingClientRect();
          const maxLength = Number(input.maxLength) || 0;
          let score = 0;

          if (!isEditableInput(input) || inputType === 'hidden' || inputType === 'password') {
            return -1;
          }

          if (matchesAnyPattern(hintText, accountHintPatterns)) {
            score += 90;
          }

          if (preferEmailMode) {
            if (/email|mail|\\u90ae\\u7bb1/u.test(hintText)) {
              score += 180;
            }

            if (/account|username|\\u8d26\\u53f7/u.test(hintText)) {
              score += 90;
            }

            if (inputType === 'email') {
              score += 160;
            }

            if (inputMode === 'email') {
              score += 120;
            }

            if (autocomplete.includes('email')) {
              score += 140;
            }

            if (
              hintText.includes('\\u624b\\u673a\\u53f7\\u7801')
              || /phone|mobile|\\u624b\\u673a/u.test(hintText)
            ) {
              score -= 220;
            }
          } else if (hintText.includes('\\u624b\\u673a\\u53f7\\u7801')) {
            score += 120;
          }

          if (normalizeText(input.id) === 'usernameId') {
            score += 60;
          }

          if (autocomplete.includes('tel')) {
            score += 35;
          }

          if (inputMode === 'numeric') {
            score += 35;
          }

          if (inputType === 'tel') {
            score += 45;
          }

          if (maxLength >= 8) {
            score += 45;
          } else if (maxLength > 0 && maxLength <= 4) {
            score -= 120;
          }

          if (rect.width >= 160) {
            score += 60;
          } else if (rect.width > 0 && rect.width < 120) {
            score -= 60;
          }

          if (
            matchesAnyPattern(hintText, hongKongPatterns)
            || matchesAnyPattern(hintText, mainlandPatterns)
            || /area\\s*code/i.test(hintText)
            || /prefix/i.test(hintText)
            || /\\u533a\\u53f7/u.test(hintText)
          ) {
            score -= 140;
          }

          if (
            preferEmailMode
            && (
              autocomplete.includes('tel')
              || inputMode === 'numeric'
              || inputType === 'tel'
            )
          ) {
            score -= 220;
          }

          if (isVisible(input)) {
            score += 40;
          }

          return score;
        });

        if (sellerAccountInput) {
          return sellerAccountInput;
        }

        const candidates = collectVisibleInputs()
          .map((input) => {
            if (input === passwordInput) {
              return {
                input,
                score: -1
              };
            }

            const inputType = normalizeText(input.type).toLowerCase();
            const autocomplete = normalizeText(input.autocomplete).toLowerCase();
            const inputMode = normalizeText(input.inputMode).toLowerCase();
            const hintText = getHintText(input);
            const rect = input.getBoundingClientRect();
            const maxLength = Number(input.maxLength) || 0;
            let score = 0;

            if (
              !isEditableInput(input)
              || ['password', 'hidden', 'checkbox', 'radio', 'submit', 'button', 'image', 'file'].includes(inputType)
            ) {
              return {
                input,
                score: -1
              };
            }

            if (matchesAnyPattern(hintText, otpHintPatterns)) {
              score -= 140;
            }

            if (matchesAnyPattern(hintText, accountHintPatterns)) {
              score += 90;
            }

            if (preferEmailMode) {
              if (/email|mail|\\u90ae\\u7bb1/u.test(hintText)) {
                score += 180;
              }

              if (/account|username|\\u8d26\\u53f7/u.test(hintText)) {
                score += 90;
              }

              if (inputType === 'email') {
                score += 160;
              }

              if (inputMode === 'email') {
                score += 120;
              }

              if (autocomplete.includes('email')) {
                score += 140;
              }

              if (
                /phone|mobile|\\u624b\\u673a/u.test(hintText)
                || autocomplete.includes('tel')
                || inputMode === 'numeric'
                || inputType === 'tel'
              ) {
                score -= 220;
              }
            }

            if (
              matchesAnyPattern(hintText, hongKongPatterns)
              || matchesAnyPattern(hintText, mainlandPatterns)
              || /area\\s*code/i.test(hintText)
              || /prefix/i.test(hintText)
              || /\\u533a\\u53f7/u.test(hintText)
            ) {
              score -= 140;
            }

            if (['text', 'email', 'number', 'tel', 'search', ''].includes(inputType)) {
              score += 20;
            }

            if (autocomplete.includes('tel')) {
              score += 35;
            }

            if (inputMode === 'numeric') {
              score += 35;
            }

            if (inputType === 'tel') {
              score += 30;
            }

            if (maxLength >= 8) {
              score += 45;
            } else if (maxLength > 0 && maxLength <= 4) {
              score -= 120;
            }

            if (rect.width >= 160) {
              score += 60;
            } else if (rect.width > 0 && rect.width < 120) {
              score -= 60;
            }

            if (passwordInput && input.form && passwordInput.form && input.form === passwordInput.form) {
              score += 20;
            }

            return {
              input,
              score
            };
          })
          .filter((entry) => entry.score > 0)
          .sort((left, right) => right.score - left.score);

        return candidates.length > 0 ? candidates[0].input : null;
      }

      function getValueSetter(element) {
        if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) {
          return null;
        }

        const prototypes = [
          Object.getPrototypeOf(element),
          element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
        ]
          .filter(Boolean);

        for (const prototype of prototypes) {
          const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

          if (descriptor && typeof descriptor.set === 'function') {
            return descriptor;
          }
        }

        return null;
      }

      function updateReactValueTracker(element, previousValue) {
        if (!element || !element._valueTracker || typeof element._valueTracker.setValue !== 'function') {
          return;
        }

        try {
          element._valueTracker.setValue(normalizeText(previousValue));
        } catch (_error) {
          // Ignore tracker failures.
        }
      }

      function dispatchSimpleEvent(element, eventName, detail) {
        if (!element || !normalizeText(eventName)) {
          return;
        }

        try {
          element.dispatchEvent(new Event(eventName, {
            bubbles: true,
            cancelable: true,
            composed: true,
            ...detail
          }));
        } catch (_error) {
          // Ignore dispatch failures.
        }
      }

      function dispatchValueEvents(element) {
        const currentValue = normalizeText(element && element.value);

        try {
          element.focus({
            preventScroll: true
          });
        } catch (_error) {
          // Ignore focus failures.
        }

        if (typeof InputEvent === 'function') {
          try {
            element.dispatchEvent(new InputEvent('beforeinput', {
              bubbles: true,
              cancelable: true,
              composed: true,
              inputType: 'insertText',
              data: currentValue
            }));
          } catch (_error) {
            // Ignore beforeinput failures.
          }
        }

        if (typeof InputEvent === 'function') {
          element.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            composed: true,
            inputType: 'insertText',
            data: currentValue
          }));
        } else {
          dispatchSimpleEvent(element, 'input');
        }

        dispatchSimpleEvent(element, 'change');
        dispatchSimpleEvent(element, 'blur');

        try {
          element.blur();
        } catch (_error) {
          // Ignore blur failures.
        }
      }

      function activateInputField(element) {
        if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) {
          return false;
        }

        try {
          element.scrollIntoView({
            block: 'center',
            inline: 'nearest'
          });
        } catch (_error) {
          // Ignore scroll failures.
        }

        const clicked = triggerPointerClick(element);

        try {
          element.focus({
            preventScroll: true
          });
        } catch (_error) {
          // Ignore focus failures.
        }

        try {
          if (typeof element.setSelectionRange === 'function') {
            const valueLength = normalizeText(element.value).length;
            element.setSelectionRange(valueLength, valueLength);
          }
        } catch (_error) {
          // Ignore caret failures.
        }

        return clicked || document.activeElement === element;
      }

      function dispatchTextInsertionEvents(element, textChunk, options) {
        if (!element) {
          return;
        }

        const normalizedTextChunk = String(textChunk || '');
        const normalizedOptions = options && typeof options === 'object' ? options : {};
        const inputType = normalizeText(normalizedOptions.inputType) || 'insertText';

        if (typeof InputEvent === 'function') {
          try {
            element.dispatchEvent(new InputEvent('beforeinput', {
              bubbles: true,
              cancelable: true,
              composed: true,
              inputType,
              data: normalizedTextChunk || null
            }));
          } catch (_error) {
            // Ignore beforeinput failures.
          }

          try {
            element.dispatchEvent(new InputEvent('input', {
              bubbles: true,
              cancelable: true,
              composed: true,
              inputType,
              data: normalizedTextChunk || null
            }));
            return;
          } catch (_error) {
            // Ignore input failures.
          }
        }

        dispatchSimpleEvent(element, 'input');
      }

      function finalizeTextEntry(element) {
        dispatchSimpleEvent(element, 'change');
        dispatchSimpleEvent(element, 'blur');

        try {
          element.blur();
        } catch (_error) {
          // Ignore blur failures.
        }
      }

      function setNativeValue(element, nextValue, options) {
        const normalizedValue = normalizeText(nextValue);
        const normalizedOptions = options && typeof options === 'object' ? options : {};

        if (!element || (!normalizedValue && normalizedOptions.allowEmpty !== true)) {
          return false;
        }

        if (normalizedOptions.activate !== false) {
          activateInputField(element);
        }

        const setter = getValueSetter(element);
        const previousValue = normalizeText(element.value);

        if (setter && typeof setter.set === 'function') {
          setter.set.call(element, normalizedValue);
        } else {
          element.value = normalizedValue;
        }

        updateReactValueTracker(element, previousValue);

        if (normalizedOptions.dispatchEvents !== false) {
          dispatchValueEvents(element);
        }

        return normalizeText(element.value) === normalizedValue;
      }

      function applySequentialDomValue(element, nextValue) {
        const normalizedValue = normalizeText(nextValue);

        if (!normalizedValue || !element) {
          return false;
        }

        const setter = getValueSetter(element);

        if (!setter || typeof setter.set !== 'function') {
          return false;
        }

        activateInputField(element);

        const existingValue = normalizeText(element.value);

        if (existingValue) {
          setter.set.call(element, '');
          updateReactValueTracker(element, existingValue);
          dispatchTextInsertionEvents(element, '', {
            inputType: 'deleteContentBackward'
          });
        }

        for (const character of normalizedValue) {
          const previousValue = normalizeText(element.value);
          setter.set.call(element, previousValue + character);
          updateReactValueTracker(element, previousValue);
          dispatchTextInsertionEvents(element, character, {
            inputType: 'insertText'
          });
        }

        finalizeTextEntry(element);
        return normalizeText(element.value) === normalizedValue;
      }

      function applyDomValue(element, nextValue) {
        const normalizedValue = normalizeText(nextValue);

        if (!normalizedValue || !element) {
          return false;
        }

        if (setNativeValue(element, normalizedValue)) {
          return true;
        }

        if (applySequentialDomValue(element, normalizedValue)) {
          return true;
        }

        try {
          if (typeof element.setSelectionRange === 'function') {
            activateInputField(element);
            element.setSelectionRange(0, normalizeText(element.value).length);
          }
        } catch (_error) {
          // Ignore selection failures.
        }

        try {
          element.value = normalizedValue;
          dispatchValueEvents(element);
        } catch (_error) {
          // Ignore fallback assignment failures.
        }

        return normalizeText(element.value) === normalizedValue;
      }

      function ensureSubmitPreparationReady(accountInput, passwordInput, options) {
        const normalizedOptions = options && typeof options === 'object' ? options : {};
        const accountMode = normalizeText(normalizedOptions.accountMode).toLowerCase() === 'text'
          ? 'text'
          : 'digits';
        const accountValue = getInputComparableValue(accountInput, accountMode);
        const passwordValue = getInputComparableValue(passwordInput, 'text');

        if (!accountValue || !passwordValue || !passwordInput) {
          return {
            ready: true,
            waitMs: 0
          };
        }

        const state = ensureSubmitPreparationState();
        const fingerprint = buildSubmitPreparationFingerprint(accountValue, passwordValue);

        if (state.fingerprint !== fingerprint) {
          state.fingerprint = fingerprint;
          state.passwordTouchedFingerprint = '';
          state.lastInteractionAt = Date.now();
        }

        if (normalizedOptions.fieldChanged === true || normalizedOptions.agreementChanged === true) {
          state.lastInteractionAt = Date.now();
        }

        if (state.passwordTouchedFingerprint !== fingerprint) {
          activateInputField(passwordInput);
          dispatchValueEvents(passwordInput);
          state.passwordTouchedFingerprint = fingerprint;
          state.lastInteractionAt = Date.now();

          return {
            ready: false,
            waitMs: submitWarmupMs
          };
        }

        const waitMs = Math.max(0, submitWarmupMs - (Date.now() - Number(state.lastInteractionAt || 0)));

        return {
          ready: waitMs <= 0,
          waitMs
        };
      }

      function applyReactAccountState(nextState, options) {
        const normalizedOptions = options && typeof options === 'object' ? options : {};
        const binding = findAccountReactBinding();

        if (!binding) {
          return false;
        }

        try {
          const currentRawValue = binding.props ? binding.props.value : null;

          if (typeof currentRawValue === 'string') {
            if (!Object.prototype.hasOwnProperty.call(nextState || {}, 'email')) {
              return false;
            }

            const emailValue = normalizeText(nextState && nextState.email);

            if (!emailValue) {
              return false;
            }

            binding.props.onChange(emailValue);
            return true;
          }

          const currentValue = currentRawValue && typeof currentRawValue === 'object'
            ? currentRawValue
            : {};
          const phoneValue = normalizeText(
            Object.prototype.hasOwnProperty.call(nextState || {}, 'phone')
              ? nextState.phone
              : currentValue.phone
          );
          const areaCodeValue = normalizeText(
            Object.prototype.hasOwnProperty.call(nextState || {}, 'areaCode')
              ? nextState.areaCode
              : currentValue.areaCode
          );
          const emailValue = normalizeText(
            Object.prototype.hasOwnProperty.call(nextState || {}, 'email')
              ? nextState.email
              : currentValue.email
          );

          if (!phoneValue && !emailValue && normalizedOptions.allowEmptyPhone !== true) {
            return false;
          }

          const mergedValue = { ...currentValue };

          if (Object.prototype.hasOwnProperty.call(nextState || {}, 'phone')) {
            mergedValue.phone = phoneValue;
          }

          if (Object.prototype.hasOwnProperty.call(nextState || {}, 'areaCode')) {
            mergedValue.areaCode = areaCodeValue;
          }

          if (Object.prototype.hasOwnProperty.call(nextState || {}, 'email')) {
            mergedValue.email = emailValue;
          }

          binding.props.onChange(mergedValue);
          return true;
        } catch (_error) {
          return false;
        }
      }

      function applyReactAccountValue(nextValue, areaCode) {
        return applyReactAccountState({
          phone: nextValue,
          areaCode
        });
      }

      function applyReactAreaCode(areaCode) {
        return applyReactAccountState({
          areaCode
        }, {
          allowEmptyPhone: true
        });
      }

      function applyReactPasswordValue(nextValue) {
        const normalizedValue = normalizeText(nextValue);
        const binding = findPasswordReactBinding();

        if (!binding || !normalizedValue) {
          return false;
        }

        try {
          binding.props.onChange(normalizedValue);
          return true;
        } catch (_error) {
          return false;
        }
      }

      function getComparablePhoneState() {
        const state = getAccountReactState();
        return {
          bindingFound: state.bindingFound,
          bindingMode: normalizeText(state.bindingMode),
          phone: normalizeDigits(state.phone),
          areaCode: state.areaCode,
          email: normalizeText(state.email),
          hasPhoneField: state.hasPhoneField === true,
          hasAreaCodeField: state.hasAreaCodeField === true,
          hasEmailField: state.hasEmailField === true
        };
      }

      function getComparablePasswordState() {
        const state = getPasswordReactState();
        return {
          bindingFound: state.bindingFound,
          value: normalizeText(state.value)
        };
      }

      function getRegionText() {
        const regionRoot = findRegionRoot();
        const reactState = getAccountReactState();

        return [
          normalizeText(reactState.areaCode),
          getRegionDisplayText(),
          normalizeText(regionRoot && regionRoot.textContent),
          normalizeText(regionRoot && regionRoot.getAttribute('aria-label')),
          normalizeText(regionRoot && regionRoot.getAttribute('title'))
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
      }

      function isHongKongRegionSelected() {
        return matchesAnyPattern(getRegionText(), hongKongPatterns);
      }

      function isMainlandRegionSelected() {
        return matchesAnyPattern(getRegionText(), mainlandPatterns);
      }

      function getFieldDiagnostics(accountInput, passwordInput) {
        const accountState = getComparablePhoneState();
        const passwordState = getComparablePasswordState();

        return {
          regionText: limitText(getRegionText(), 120),
          accountInput: describeElement(accountInput, {
            visibleTailLength: 4
          }),
          passwordInput: describeElement(passwordInput, {
            visibleTailLength: 0
          }),
          reactAccount: {
            bindingFound: accountState.bindingFound,
            bindingMode: accountState.bindingMode,
            phoneLength: accountState.phone.length,
            phonePreview: maskText(accountState.phone, 4),
            areaCode: limitText(accountState.areaCode, 40),
            emailLength: accountState.email.length,
            emailPreview: maskText(accountState.email, 6),
            hasPhoneField: accountState.hasPhoneField === true,
            hasAreaCodeField: accountState.hasAreaCodeField === true,
            hasEmailField: accountState.hasEmailField === true
          },
          reactPassword: {
            bindingFound: passwordState.bindingFound,
            valueLength: passwordState.value.length
          }
        };
      }

      function resolvePhoneInputPlan(phoneNumber) {
        const text = normalizeText(phoneNumber);

        if (isEmail(text)) {
          return {
            mode: 'email',
            inputValue: text
          };
        }

        const digits = normalizeDigits(phoneNumber);
        let mainlandMatch = '';
        let hongKongMatch = '';

        if (!digits) {
          return {
            mode: 'mainland',
            inputValue: normalizeText(phoneNumber)
          };
        }

        mainlandMatch = digits.match(/^(?:86|0086)?(1\\d{10})$/);

        if (mainlandMatch && mainlandMatch[1]) {
          return {
            mode: 'mainland',
            inputValue: mainlandMatch[1]
          };
        }

        hongKongMatch = digits.match(/^(?:852|00852)?(\\d{8})$/);

        if (hongKongMatch && hongKongMatch[1]) {
          return {
            mode: 'hongkong',
            inputValue: hongKongMatch[1]
          };
        }

        return {
          mode: digits.length === 11 ? 'mainland' : 'hongkong',
          inputValue: digits.length > 11 ? digits.slice(-8) : digits
        };
      }

      function shouldUseHongKongRegion(phoneNumber) {
        return !isEmail(normalizeText(phoneNumber)) && resolvePhoneInputPlan(phoneNumber).mode === 'hongkong';
      }

      function resolveRegionAreaCode(mode) {
        if (normalizeText(mode).toLowerCase() === 'hongkong') {
          return '852';
        }

        return '86';
      }

      function normalizePhoneNumberForInput(phoneNumber) {
        return resolvePhoneInputPlan(phoneNumber).inputValue;
      }

      function triggerPointerClick(element) {
        if (!(element instanceof HTMLElement)) {
          return false;
        }

        try {
          element.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            composed: true
          }));
          element.dispatchEvent(new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true,
            composed: true
          }));
          element.click();
          return true;
        } catch (_error) {
          try {
            element.click();
            return true;
          } catch (__error) {
            return false;
          }
        }
      }

      function dispatchKeyboardEvent(element, key) {
        if (!(element instanceof HTMLElement)) {
          return false;
        }

        const normalizedKey = normalizeText(key);

        if (!normalizedKey) {
          return false;
        }

        try {
          element.focus({
            preventScroll: true
          });
        } catch (_error) {
          // Ignore focus failures.
        }

        try {
          ['keydown', 'keyup'].forEach((eventName) => {
            element.dispatchEvent(new KeyboardEvent(eventName, {
              key: normalizedKey,
              bubbles: true,
              cancelable: true,
              composed: true
            }));
          });
          return true;
        } catch (_error) {
          return false;
        }
      }

      function isRegionDisplayInput(input) {
        if (!(input instanceof HTMLInputElement) || !isVisible(input)) {
          return false;
        }

        if (normalizeText(input.id) === 'usernameId' || normalizeText(input.id) === 'passwordId') {
          return false;
        }

        const valueText = normalizeText(input.value);
        const hintText = getHintText(input);
        const rect = input.getBoundingClientRect();

        if (
          matchesAnyPattern(hintText, hongKongPatterns)
          || matchesAnyPattern(hintText, mainlandPatterns)
        ) {
          return true;
        }

        if (/^\\+?\\d{2,4}$/.test(valueText) && rect.width > 0 && rect.width <= 120) {
          return true;
        }

        if (input.readOnly === true && rect.width > 0 && rect.width <= 120) {
          return true;
        }

        return false;
      }

      function findRegionRoot() {
        const usernameRoot = findRegionBindingRoot();

        if (!usernameRoot) {
          return null;
        }

        let currentElement = usernameRoot.parentElement;
        let depth = 0;

        while (currentElement && depth < 8) {
          const visibleInputs = Array.from(currentElement.querySelectorAll('input'))
            .filter((input) => input instanceof HTMLInputElement && isVisible(input));

          if (
            visibleInputs.includes(usernameRoot)
            && visibleInputs.some((input) => isRegionDisplayInput(input))
          ) {
            return currentElement;
          }

          currentElement = currentElement.parentElement;
          depth += 1;
        }

        return usernameRoot.parentElement || usernameRoot;
      }

      function findRegionDisplayInput(regionRoot) {
        const rootElement = regionRoot || findRegionRoot();

        if (!rootElement) {
          return null;
        }

        const localCandidates = Array.from(rootElement.querySelectorAll('input'))
          .filter((input) => isRegionDisplayInput(input))
          .sort((left, right) => left.getBoundingClientRect().width - right.getBoundingClientRect().width);

        if (localCandidates.length > 0) {
          return localCandidates[0];
        }

        const globalCandidates = collectVisibleInputs()
          .filter((input) => isRegionDisplayInput(input))
          .sort((left, right) => left.getBoundingClientRect().width - right.getBoundingClientRect().width);

        return globalCandidates.length > 0 ? globalCandidates[0] : null;
      }

      function getRegionDisplayText() {
        const regionDisplayInput = findRegionDisplayInput();

        return normalizeText(regionDisplayInput && regionDisplayInput.value).toLowerCase();
      }

      function findRegionTriggerElement(regionRoot) {
        const rootElement = regionRoot || findRegionRoot();
        const regionDisplayInput = findRegionDisplayInput(rootElement);
        const candidates = [];

        if (regionDisplayInput) {
          candidates.push(regionDisplayInput);

          let currentElement = regionDisplayInput.parentElement;
          let depth = 0;

          while (currentElement && rootElement && depth < 5) {
            if (isVisible(currentElement)) {
              candidates.push(currentElement);
            }

            if (currentElement === rootElement) {
              break;
            }

            currentElement = currentElement.parentElement;
            depth += 1;
          }
        }

        Array.from((rootElement || document).querySelectorAll(
          '[role="combobox"], [aria-haspopup="listbox"], [aria-haspopup="menu"], button, [class*="select"], [class*="dropdown"], [class*="prefix"]'
        ))
          .filter((element) => isVisible(element))
          .forEach((element) => {
            if (!candidates.includes(element)) {
              candidates.push(element);
            }
          });

        return candidates.find((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.width <= 220 && rect.height > 0 && rect.height <= 90;
        }) || candidates[0] || null;
      }

      function collectVisibleRegionOptions() {
        return Array.from(document.querySelectorAll('li, button, div, span'))
          .filter((element) => isVisible(element))
          .map((element) => ({
            element,
            text: normalizeText(element.textContent).toLowerCase(),
            rect: element.getBoundingClientRect()
          }))
          .filter((entry) => {
            if (!entry.text || entry.text.length > 32) {
              return false;
            }

            if (entry.rect.width < 90 || entry.rect.height < 20) {
              return false;
            }

            return (
              matchesAnyPattern(entry.text, hongKongPatterns)
              || matchesAnyPattern(entry.text, mainlandPatterns)
            );
          })
          .filter((entry) => {
            return !Array.from(entry.element.children).some((child) => {
              if (!(child instanceof HTMLElement) || !isVisible(child)) {
                return false;
              }

              const childText = normalizeText(child.textContent).toLowerCase();
              return (
                childText
                && childText.length <= 32
                && (
                  matchesAnyPattern(childText, hongKongPatterns)
                  || matchesAnyPattern(childText, mainlandPatterns)
                )
              );
            });
          });
      }

      function findVisibleHongKongOption() {
        const candidates = collectVisibleRegionOptions()
          .filter((entry) => matchesAnyPattern(entry.text, hongKongPatterns))
          .sort((left, right) => {
            if (left.rect.top !== right.rect.top) {
              return left.rect.top - right.rect.top;
            }

            return left.text.length - right.text.length;
          });

        return candidates.length > 0 ? candidates[0].element : null;
      }

      function ensureHongKongRegion() {
        const regionRoot = findRegionRoot();
        const regionDisplayInput = findRegionDisplayInput(regionRoot);
        const targetAreaCode = resolveRegionAreaCode('hongkong');

        if (!regionRoot) {
          return true;
        }

        if (
          isHongKongRegionSelected()
          || matchesAnyPattern(getRegionDisplayText(), hongKongPatterns)
        ) {
          return true;
        }

        if (applyReactAreaCode(targetAreaCode)) {
          const accountState = getAccountReactState();
          const regionDisplayText = getRegionDisplayText();

          if (
            normalizeText(accountState.areaCode) === targetAreaCode
            || matchesAnyPattern(regionDisplayText, hongKongPatterns)
          ) {
            return true;
          }
        }

        const selectElement = Array.from(regionRoot.querySelectorAll('select'))
          .find((element) => isVisible(element));

        if (selectElement) {
          const options = Array.from(selectElement.options || []);
          const targetOption = options.find((option) => matchesAnyPattern(
            getHintText(option),
            hongKongPatterns
          )) || options[1];

          if (!targetOption) {
            return true;
          }

          selectElement.selectedIndex = targetOption.index;
          selectElement.value = targetOption.value;
          dispatchValueEvents(selectElement);
          return (
            isHongKongRegionSelected()
            || matchesAnyPattern(getRegionDisplayText(), hongKongPatterns)
            || matchesAnyPattern(getHintText(regionRoot), hongKongPatterns)
          );
        }

        const visibleOption = findVisibleHongKongOption();

        if (visibleOption) {
          triggerPointerClick(visibleOption);
          return (
            isHongKongRegionSelected()
            || matchesAnyPattern(getRegionDisplayText(), hongKongPatterns)
            || matchesAnyPattern(getHintText(regionRoot), hongKongPatterns)
          );
        }

        const triggerElement = findRegionTriggerElement(regionRoot)
          || regionDisplayInput
          || (isVisible(regionRoot) ? regionRoot : null);

        if (!triggerElement) {
          return false;
        }

        triggerPointerClick(triggerElement);
        if (regionDisplayInput && regionDisplayInput !== triggerElement) {
          triggerPointerClick(regionDisplayInput);
        }

        const postClickVisibleOption = findVisibleHongKongOption();

        if (postClickVisibleOption) {
          triggerPointerClick(postClickVisibleOption);
          return (
            isHongKongRegionSelected()
            || matchesAnyPattern(getRegionDisplayText(), hongKongPatterns)
            || matchesAnyPattern(getHintText(regionRoot), hongKongPatterns)
          );
        }

        if (dispatchKeyboardEvent(triggerElement, 'ArrowDown')) {
          dispatchKeyboardEvent(triggerElement, 'ArrowDown');
          dispatchKeyboardEvent(triggerElement, 'Enter');
        }

        return (
          isHongKongRegionSelected()
          || matchesAnyPattern(getRegionDisplayText(), hongKongPatterns)
          || matchesAnyPattern(getHintText(regionRoot), hongKongPatterns)
        );
      }

      function findAgreementCheckbox() {
        const directCandidates = Array.from(document.querySelectorAll('input[type="checkbox"], [role="checkbox"]'))
          .map((element) => {
            const hintText = [
              getHintText(element),
              getHintText(element.parentElement),
              getHintText(element.closest('label, div, span, p, section'))
            ]
              .filter(Boolean)
              .join(' ');
            const container = element.closest('label, div, span, p, section');
            let score = 0;

            if (matchesAnyPattern(hintText, agreementHintPatterns)) {
              score += 220;
            }

            if (matchesAnyPattern(hintText, authorizationAgreementHintPatterns)) {
              score += 140;
            }

            if (isVisible(element)) {
              score += 60;
            } else if (container && isVisible(container)) {
              score += 40;
            }

            if (element instanceof HTMLInputElement && normalizeText(element.type).toLowerCase() === 'checkbox') {
              score += 40;
            }

            if (normalizeText(element.getAttribute('role')).toLowerCase() === 'checkbox') {
              score += 36;
            }

            return {
              element,
              score
            };
          })
          .filter((entry) => entry.score > 0)
          .sort((left, right) => right.score - left.score);

        if (directCandidates.length > 0) {
          return directCandidates[0].element;
        }

        const agreementTextCandidates = Array.from(document.querySelectorAll('label, div, span, p, section'))
          .filter((element) => element instanceof HTMLElement && isVisible(element))
          .map((element) => {
            const hintText = getHintText(element);
            const rect = element.getBoundingClientRect();
            let score = 0;

            if (!matchesAnyPattern(hintText, agreementHintPatterns)) {
              return {
                element,
                score: -1
              };
            }

            if (hintText.length > 360 || rect.width <= 80 || rect.height <= 12 || rect.height >= 90) {
              return {
                element,
                score: -1
              };
            }

            score += 120;

            if (matchesAnyPattern(hintText, authorizationAgreementHintPatterns)) {
              score += 120;
            }

            if (normalizeText(element.tagName).toLowerCase() === 'label') {
              score += 60;
            }

            if (hintText.length <= 80) {
              score += 20;
            }

            return {
              element,
              score
            };
          })
          .filter((entry) => entry.score > 0)
          .sort((left, right) => right.score - left.score);

        if (agreementTextCandidates.length === 0) {
          return null;
        }

        const agreementTextContainer = agreementTextCandidates[0].element;
        const agreementRect = agreementTextContainer.getBoundingClientRect();
        const agreementScopeRoots = [
          agreementTextContainer,
          agreementTextContainer.closest('label'),
          agreementTextContainer.closest('div, section, form'),
          agreementTextContainer.parentElement,
          agreementTextContainer.previousElementSibling,
          agreementTextContainer.nextElementSibling
        ]
          .filter((element) => element instanceof HTMLElement);
        const agreementSeen = new Set();
        const customCandidates = [];

        agreementScopeRoots.forEach((scopeRoot) => {
          const scopeElements = [
            scopeRoot,
            ...Array.from(scopeRoot.querySelectorAll('button, [role="button"], [role="checkbox"], label, span, div, i, em, strong, svg'))
          ];

          scopeElements.forEach((element) => {
            if (!(element instanceof HTMLElement) || agreementSeen.has(element) || !isVisible(element)) {
              return;
            }

            agreementSeen.add(element);

            if (normalizeText(element.tagName).toLowerCase() === 'a') {
              return;
            }

            const rect = element.getBoundingClientRect();
            const stateText = [
              normalizeText(element.className),
              normalizeText(element.id),
              normalizeText(element.getAttribute('data-testid')),
              normalizeText(element.getAttribute('role'))
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            const hintText = getHintText(element);
            let score = 0;

            if (element === agreementTextContainer) {
              score += 80;
            }

            if (normalizeText(element.getAttribute('role')).toLowerCase() === 'checkbox') {
              score += 220;
            }

            if (normalizeText(element.tagName).toLowerCase() === 'label') {
              score += 60;
            }

            if (matchesAnyPattern(hintText, authorizationAgreementHintPatterns)) {
              score += 90;
            }

            if (/(checkbox|check|tick|agree|policy|authorize)/i.test(stateText + ' ' + hintText)) {
              score += 120;
            }

            if (rect.width >= 10 && rect.width <= 42 && rect.height >= 10 && rect.height <= 42) {
              score += 70;
            }

            if (Math.abs(rect.top - agreementRect.top) <= 24 || Math.abs(rect.bottom - agreementRect.bottom) <= 24) {
              score += 28;
            }

            if (rect.right <= agreementRect.left + 48) {
              score += 60;
            }

            if (rect.width <= Math.max(agreementRect.width + 80, 360) && rect.height <= 64) {
              score += 16;
            }

            customCandidates.push({
              element,
              score
            });
          });
        });

        const pointTargets = [
          {
            x: Math.max(4, agreementRect.left - 36),
            y: agreementRect.top + agreementRect.height / 2
          },
          {
            x: Math.max(4, agreementRect.left - 24),
            y: agreementRect.top + agreementRect.height / 2
          },
          {
            x: Math.max(4, agreementRect.left - 12),
            y: agreementRect.top + agreementRect.height / 2
          },
          {
            x: agreementRect.left + 8,
            y: agreementRect.top + agreementRect.height / 2
          },
          {
            x: Math.max(4, agreementRect.left - 8),
            y: agreementRect.top + agreementRect.height / 2
          },
          {
            x: Math.max(4, agreementRect.left - 18),
            y: agreementRect.top + agreementRect.height / 2
          }
        ];

        pointTargets.forEach((point) => {
          if (
            point.x < 0
            || point.y < 0
            || point.x > window.innerWidth
            || point.y > window.innerHeight
          ) {
            return;
          }

          const pointElements = typeof document.elementsFromPoint === 'function'
            ? document.elementsFromPoint(point.x, point.y)
            : [document.elementFromPoint(point.x, point.y)].filter(Boolean);

          pointElements.forEach((pointElement, index) => {
            const element = pointElement instanceof HTMLElement
              ? (
                pointElement.closest('input[type="checkbox"], [role="checkbox"], button, [role="button"], label, div, span, i, em, strong, svg')
                || pointElement
              )
              : null;

            if (!(element instanceof HTMLElement) || agreementSeen.has(element) || !isVisible(element)) {
              return;
            }

            if (normalizeText(element.tagName).toLowerCase() === 'a') {
              return;
            }

            agreementSeen.add(element);
            customCandidates.push({
              element,
              score: 180 - index * 12
            });
          });
        });

        customCandidates.sort((left, right) => right.score - left.score);
        return customCandidates.length > 0 ? customCandidates[0].element : agreementTextContainer;
      }

      function isCheckboxChecked(element) {
        if (!element) {
          return false;
        }

        if (element instanceof HTMLInputElement) {
          return element.checked === true;
        }

        if (normalizeText(element.getAttribute('aria-checked')).toLowerCase() === 'true') {
          return true;
        }

        if (
          normalizeText(element.getAttribute('aria-pressed')).toLowerCase() === 'true'
          || normalizeText(element.getAttribute('aria-selected')).toLowerCase() === 'true'
          || normalizeText(element.getAttribute('data-checked')).toLowerCase() === 'true'
          || normalizeText(element.getAttribute('data-selected')).toLowerCase() === 'true'
        ) {
          return true;
        }

        const nestedCheckbox = element instanceof HTMLElement
          ? element.querySelector('input[type="checkbox"], [role="checkbox"]')
          : null;

        if (nestedCheckbox && nestedCheckbox !== element && isCheckboxChecked(nestedCheckbox)) {
          return true;
        }

        const checkedIcon = element instanceof HTMLElement
          ? Array.from(element.querySelectorAll('[class*="CBX_iconCheck"], [class*="iconCheck"], [class*="hasCheckSquare"]'))
            .find((candidate) => (
              candidate instanceof HTMLElement
              && isVisible(candidate)
              && !/prevchecksquare/i.test(normalizeText(candidate.className))
            ))
          : null;

        if (checkedIcon instanceof HTMLElement) {
          return true;
        }

        const stateText = [
          normalizeText(element.className),
          normalizeText(element.id),
          normalizeText(element.getAttribute('data-state')),
          normalizeText(element.getAttribute('data-status')),
          normalizeText(element.getAttribute('data-checked')),
          normalizeText(element.getAttribute('data-selected')),
          normalizeText(element.getAttribute('data-testid')),
          normalizeText(element.getAttribute('aria-checked')),
          normalizeText(element.getAttribute('aria-selected')),
          normalizeText(element.getAttribute('aria-pressed')),
          normalizeText(element.getAttribute('checked'))
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return (
          agreementCheckedStatePatterns.some((pattern) => pattern.test(stateText))
          || /cbx_iconcheck/i.test(stateText)
        ) && !agreementUncheckedStatePatterns.some((pattern) => pattern.test(stateText));
      }

      function getAgreementStateText(element) {
        if (!(element instanceof HTMLElement)) {
          return '';
        }

        return [
          normalizeText(element.className),
          normalizeText(element.id),
          normalizeText(element.getAttribute('data-state')),
          normalizeText(element.getAttribute('data-status')),
          normalizeText(element.getAttribute('data-checked')),
          normalizeText(element.getAttribute('data-selected')),
          normalizeText(element.getAttribute('data-testid')),
          normalizeText(element.getAttribute('aria-checked')),
          normalizeText(element.getAttribute('aria-selected')),
          normalizeText(element.getAttribute('aria-pressed')),
          normalizeText(element.getAttribute('checked'))
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
      }

      function ensureAgreementAccepted() {
        const checkboxElement = findAgreementCheckbox();
        const agreementGatedLoginPage = isAgreementGatedLoginPage();
        const submitButton = findSubmitButton();
        const canUseAuthorizationSubmitFallback = Boolean(
          agreementGatedLoginPage
          && submitButton
          && !isElementDisabled(submitButton)
          && (
            matchesAnyPattern(getHintText(submitButton), authorizationConfirmHintPatterns)
            || (!checkboxElement && getHintText(submitButton).includes('\\u6388\\u6743\\u767b\\u5f55'))
          )
        );

        if (!checkboxElement) {
          return {
            accepted: (
              !matchesAnyPattern(
                limitText(normalizeText(document.body && document.body.innerText), 1200),
                agreementHintPatterns
              )
              || canUseAuthorizationSubmitFallback
            ),
            changed: false
          };
        }

        if (isCheckboxChecked(checkboxElement)) {
          return {
            accepted: true,
            changed: false
          };
        }

        if (canUseAuthorizationSubmitFallback) {
          return {
            accepted: true,
            changed: false
          };
        }

        const agreementTextContainer = checkboxElement.closest('label, div, span, p, section');
        const clickTargets = [
          checkboxElement,
          checkboxElement.closest('label'),
          checkboxElement.closest('div, section, form'),
          checkboxElement.parentElement,
          agreementTextContainer,
          agreementTextContainer && agreementTextContainer.parentElement,
          agreementTextContainer && agreementTextContainer.previousElementSibling,
          agreementTextContainer && agreementTextContainer.nextElementSibling
        ].filter((element, index, collection) => (
          element instanceof HTMLElement && collection.indexOf(element) === index
        ));

        const initialStateText = getAgreementStateText(checkboxElement);
        let refreshedCheckbox = checkboxElement;
        let refreshedStateText = initialStateText;
        let clicked = false;

        for (const target of clickTargets) {
          refreshedCheckbox = findAgreementCheckbox() || refreshedCheckbox;
          refreshedStateText = getAgreementStateText(refreshedCheckbox);

          if (isCheckboxChecked(refreshedCheckbox)) {
            break;
          }

          if (matchesAnyPattern(getHintText(refreshedCheckbox), authorizationAgreementHintPatterns)) {
            if (shouldThrottleAuthorizationAgreementClick()) {
              return {
                accepted: false,
                changed: false,
                throttled: true
              };
            }

            markAuthorizationAgreementClicked();
          }

          clicked = triggerPointerClick(target) || clicked;

          refreshedCheckbox = findAgreementCheckbox() || refreshedCheckbox;
          refreshedStateText = getAgreementStateText(refreshedCheckbox);

          if (
            isCheckboxChecked(refreshedCheckbox)
            || (
              refreshedStateText
              && refreshedStateText !== initialStateText
              && !agreementUncheckedStatePatterns.some((pattern) => pattern.test(refreshedStateText))
            )
          ) {
            return {
              accepted: true,
              changed: true
            };
          }

          if (matchesAnyPattern(getHintText(refreshedCheckbox), authorizationAgreementHintPatterns)) {
            break;
          }
        }

        if (matchesAnyPattern(getHintText(refreshedCheckbox), authorizationAgreementHintPatterns)) {
          return {
            accepted: isCheckboxChecked(refreshedCheckbox),
            changed: clicked
          };
        }

        if (!isCheckboxChecked(refreshedCheckbox) && refreshedCheckbox instanceof HTMLInputElement) {
          try {
            refreshedCheckbox.checked = true;
          } catch (_error) {
            // Ignore checked assignment failures.
          }

          dispatchSimpleEvent(refreshedCheckbox, 'input');
          dispatchSimpleEvent(refreshedCheckbox, 'change');
          dispatchSimpleEvent(refreshedCheckbox, 'click');
        }

        if (!isCheckboxChecked(refreshedCheckbox) && normalizeText(refreshedCheckbox.getAttribute('role')) === 'checkbox') {
          try {
            refreshedCheckbox.setAttribute('aria-checked', 'true');
          } catch (_error) {
            // Ignore aria updates.
          }

          dispatchSimpleEvent(refreshedCheckbox, 'input');
          dispatchSimpleEvent(refreshedCheckbox, 'change');
          dispatchSimpleEvent(refreshedCheckbox, 'click');
        }

        const finalCheckbox = findAgreementCheckbox() || refreshedCheckbox;
        const finalStateText = getAgreementStateText(finalCheckbox);
        const accepted = isCheckboxChecked(finalCheckbox);

        return {
          accepted: accepted || canUseAuthorizationSubmitFallback,
          changed: (
            accepted
            || (
              finalStateText
              && finalStateText !== initialStateText
              && !agreementUncheckedStatePatterns.some((pattern) => pattern.test(finalStateText))
            )
            || canUseAuthorizationSubmitFallback
          )
        };
      }

      function hasVisibleOtpInput() {
        return collectVisibleInputs().some((input) => matchesAnyPattern(
          getHintText(input),
          otpHintPatterns
        ));
      }

      function hasLockedVerificationInputs() {
        const usernameRoot = document.getElementById('userEmailId') || document.getElementById('usernameId');
        const passwordRoot = document.getElementById('passwordId');

        return Boolean(
          usernameRoot instanceof HTMLInputElement
          && passwordRoot instanceof HTMLInputElement
          && usernameRoot.disabled === true
          && passwordRoot.disabled === true
          && normalizeText(usernameRoot.value)
          && normalizeText(passwordRoot.value)
        );
      }

      function hasVisibleVerificationChallenge() {
        if (hasVisibleOtpInput() || hasLockedVerificationInputs()) {
          return true;
        }

        if (isAgreementGatedLoginPage()) {
          return false;
        }

        const verificationSelectors = [
          'canvas',
          'iframe[src*="captcha"]',
          'iframe[src*="verify"]',
          'img[src*="captcha"]',
          'img[src*="verify"]',
          '[role="dialog"]',
          '[class*="captcha"]',
          '[class*="verify"]',
          '[class*="slider"]',
          '[class*="geetest"]',
          '[class*="challenge"]',
          '[class*="security"]',
          '[id*="captcha"]',
          '[id*="verify"]',
          '[id*="slider"]',
          '[id*="challenge"]'
        ].join(', ');

        return Array.from(document.querySelectorAll(verificationSelectors))
          .filter((element) => isVisible(element))
          .some((element) => {
            const verificationHintText = [
              getHintText(element),
              normalizeText(element.getAttribute('src')),
              normalizeText(element.getAttribute('alt')),
              normalizeText(element.getAttribute('data-testid')),
              normalizeText(element.id),
              normalizeText(element.className)
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();

            return matchesAnyPattern(verificationHintText, verificationHintPatterns);
          });
      }

      function findSubmitButton() {
        const candidates = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]'))
          .filter((element) => isVisible(element))
          .map((element) => {
            const hintText = getHintText(element);
            let score = 0;

            if (hintText.includes('\\u6388\\u6743\\u767b\\u5f55')) {
              score += 160;
            }

            if (hintText.includes('\\u767b\\u5f55')) {
              score += 110;
            }

            if (hintText.includes('submit')) {
              score += 30;
            }

            return {
              element,
              score
            };
          })
          .filter((entry) => entry.score > 0)
          .sort((left, right) => right.score - left.score);

        return candidates.length > 0 ? candidates[0].element : null;
      }

      function findAuthorizationConfirmButton() {
        const candidates = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"], a, div, span'))
          .filter((element) => element instanceof HTMLElement && isVisible(element))
          .map((element) => {
            const hintText = getHintText(element);
            const clickableTarget = element.closest('button, [role="button"], input[type="submit"], a') || element;
            let score = 0;

            if (!matchesAnyPattern(hintText, authorizationConfirmHintPatterns)) {
              return {
                element,
                score: -1
              };
            }

            if (hintText.replace(/\\s+/g, '') === '\\u786e\\u8ba4\\u6388\\u6743\\u5e76\\u524d\\u5f80') {
              score += 260;
            } else {
              score += 180;
            }

            if (normalizeText(element.tagName).toLowerCase() === 'button') {
              score += 80;
            }

            if (normalizeText(element.getAttribute('role')).toLowerCase() === 'button') {
              score += 60;
            }

            if (isElementDisabled(clickableTarget)) {
              score -= 80;
            }

            if (hintText.length <= 80) {
              score += 30;
            }

            return {
              element: clickableTarget,
              score
            };
          })
          .filter((entry) => entry.score > 0)
          .sort((left, right) => right.score - left.score);

        return candidates.length > 0 ? candidates[0].element : null;
      }

      function findLoginAgreementConfirmButton() {
        const candidates = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"], a, div, span'))
          .filter((element) => element instanceof HTMLElement && isVisible(element))
          .map((element) => {
            const hintText = getHintText(element);
            const clickableTarget = element.closest('button, [role="button"], input[type="submit"], a') || element;
            let score = 0;

            if (!matchesAnyPattern(hintText, loginAgreementConfirmHintPatterns)) {
              return {
                element,
                score: -1
              };
            }

            if (hintText.replace(/\\s+/g, '') === '\\u540c\\u610f\\u5e76\\u767b\\u5f55') {
              score += 240;
            } else {
              score += 160;
            }

            if (normalizeText(element.tagName).toLowerCase() === 'button') {
              score += 70;
            }

            if (normalizeText(element.getAttribute('role')).toLowerCase() === 'button') {
              score += 50;
            }

            if (isElementDisabled(clickableTarget)) {
              score -= 90;
            }

            if (hintText.length <= 60) {
              score += 24;
            }

            return {
              element: clickableTarget,
              score
            };
          })
          .filter((entry) => entry.score > 0)
          .sort((left, right) => right.score - left.score);

        return candidates.length > 0 ? candidates[0].element : null;
      }

      function isElementDisabled(element) {
        if (!(element instanceof HTMLElement)) {
          return true;
        }

        if ('disabled' in element && element.disabled === true) {
          return true;
        }

        return normalizeText(element.getAttribute('aria-disabled')).toLowerCase() === 'true';
      }

      function handleAuthorizationOnlyPage() {
        const bodyText = limitText(normalizeText(document.body && document.body.innerText), 1600);
        const hasAuthorizationAgreement = matchesAnyPattern(bodyText, authorizationAgreementHintPatterns);
        const passwordInput = findPasswordInput();
        const accountInput = findAccountInput(passwordInput);
        const hasSellerCenterAuthorizationContext = Boolean(
          /\\u60a8\\u6388\\u6743.*\\u8d26\\u53f7\\s*id.*\\u5e97\\u94fa\\u540d\\u79f0.*\\u5356\\u5bb6\\u4e2d\\u5fc3\\u5404\\u677f\\u5757.*\\u9605\\u8bfb\\u5e76\\u540c\\u610f/iu.test(bodyText)
          || findAuthorizationConfirmButton()
          || /\\u5373\\u5c06\\u524d\\u5f80/u.test(bodyText)
          || /\\u5356\\u5bb6\\u4e2d\\u5fc3\\u5404\\u677f\\u5757/u.test(bodyText)
          || /\\u8d26\\u53f7\\s*id.*\\u5e97\\u94fa\\u540d\\u79f0/iu.test(bodyText)
          || /account\\s*id.*shop\\s*name/i.test(bodyText)
        );

        if (passwordInput && accountInput) {
          return {
            handled: false
          };
        }

        if (!hasAuthorizationAgreement || !hasSellerCenterAuthorizationContext) {
          return {
            handled: false
          };
        }

        const agreementResult = ensureAgreementAccepted();

        if (!agreementResult.accepted) {
          return {
            handled: true,
            status: 'pending-authorization',
            agreementAccepted: false,
            agreementChanged: agreementResult.changed === true,
            agreementThrottled: agreementResult.throttled === true,
            confirmFound: findAuthorizationConfirmButton() instanceof HTMLElement,
            confirmDisabled: (
              findAuthorizationConfirmButton() instanceof HTMLElement
              && isElementDisabled(findAuthorizationConfirmButton())
            )
          };
        }

        if (agreementResult.changed === true) {
          return {
            handled: true,
            status: 'pending-authorization',
            agreementAccepted: true,
            agreementChanged: true,
            waitMs: agreementWarmupMs,
            confirmFound: findAuthorizationConfirmButton() instanceof HTMLElement,
            confirmDisabled: (
              findAuthorizationConfirmButton() instanceof HTMLElement
              && isElementDisabled(findAuthorizationConfirmButton())
            )
          };
        }

        const refreshedConfirmButton = findAuthorizationConfirmButton();

        if (refreshedConfirmButton && !isElementDisabled(refreshedConfirmButton)) {
          triggerPointerClick(refreshedConfirmButton);
          return {
            handled: true,
            status: 'authorization-confirm-clicked',
            agreementAccepted: true,
            agreementChanged: agreementResult.changed === true,
            clickedText: limitText(getHintText(refreshedConfirmButton), 120)
          };
        }

        return {
          handled: true,
          status: 'pending-authorization',
          agreementAccepted: agreementResult.accepted === true,
          agreementChanged: agreementResult.changed === true,
          agreementThrottled: agreementResult.throttled === true,
          confirmFound: refreshedConfirmButton instanceof HTMLElement,
          confirmDisabled: refreshedConfirmButton instanceof HTMLElement && isElementDisabled(refreshedConfirmButton)
        };
      }

      function runAutofillAttempt() {
        const effectiveAuthConfig = resolveEffectiveAuthConfig();
        const effectiveAccountIdentity = resolveAuthIdentity(effectiveAuthConfig);
        const accountValueFromIdentity = normalizeText(effectiveAccountIdentity && effectiveAccountIdentity.accountValue);
        const accountValue = accountValueFromIdentity
          || normalizeText(effectiveAuthConfig && effectiveAuthConfig.accountValue)
          || normalizeText(effectiveAuthConfig && effectiveAuthConfig.email)
          || normalizeText(effectiveAuthConfig && effectiveAuthConfig.phoneNumber);
        const explicitEmailMode = normalizeText(effectiveAccountIdentity && effectiveAccountIdentity.accountType) === 'email';
        const phoneInputPlan = explicitEmailMode
          ? {
            mode: 'email',
            inputValue: accountValue
          }
          : resolvePhoneInputPlan(accountValue);
        if (explicitEmailMode && phoneInputPlan.mode !== 'email') {
          return {
            status: 'auth-type-conflict',
            phoneInputMode: phoneInputPlan.mode,
            helperVersion,
            authConfigSource: normalizeText(effectiveAuthConfig && effectiveAuthConfig.authConfigSource),
            resolvedAccountType: normalizeText(effectiveAccountIdentity && effectiveAccountIdentity.accountType),
            resolvedAccountValuePreview: maskText(accountValue, 6),
            message: '\u767B\u5F55\u8D26\u53F7\u7C7B\u578B\u51B2\u7A81\uFF0C\u90AE\u7BB1\u8D26\u53F7\u4E0D\u4F1A\u56DE\u9000\u4E3A\u624B\u673A\u53F7\u6A21\u5F0F\u3002'
          };
        }
        const currentHref = normalizeText(window.location && window.location.href);
        const currentHostname = normalizeText(window.location && window.location.hostname).toLowerCase();
        const currentPathname = normalizeText(window.location && window.location.pathname).toLowerCase();

        if (!hasCompleteAuthConfig(effectiveAuthConfig)) {
          return {
            status: 'missing-auth',
            helperVersion,
            authConfigSource: normalizeText(effectiveAuthConfig && effectiveAuthConfig.authConfigSource),
            resolvedAccountType: normalizeText(effectiveAccountIdentity && effectiveAccountIdentity.accountType),
            resolvedAccountValuePreview: maskText(accountValue, 6)
          };
        }

        if (
          !/(^|\\.)kuajingmaihuo\\.com$/i.test(currentHostname)
          || !(
            /^\\/settle\\/seller-login$/i.test(currentPathname)
            || /^\\/settle\\/activity-login$/i.test(currentPathname)
            || /^\\/login$/i.test(currentPathname)
          )
        ) {
          return {
            status: 'page-route-changed',
            phoneInputMode: phoneInputPlan.mode,
            helperVersion,
            authConfigSource: normalizeText(effectiveAuthConfig && effectiveAuthConfig.authConfigSource),
            resolvedAccountType: normalizeText(effectiveAccountIdentity && effectiveAccountIdentity.accountType),
            resolvedAccountValuePreview: maskText(accountValue, 6),
            message: currentHref
          };
        }

        const authorizationOnlyPageResult = handleAuthorizationOnlyPage();

        if (authorizationOnlyPageResult.handled === true) {
          return {
            ...authorizationOnlyPageResult,
            filledAccount: authorizationOnlyPageResult.status === 'authorization-confirm-clicked',
            filledPassword: authorizationOnlyPageResult.status === 'authorization-confirm-clicked',
            phoneInputMode: phoneInputPlan.mode,
            helperVersion,
            authConfigSource: normalizeText(effectiveAuthConfig && effectiveAuthConfig.authConfigSource),
            resolvedAccountType: normalizeText(effectiveAccountIdentity && effectiveAccountIdentity.accountType),
            resolvedAccountValuePreview: maskText(accountValue, 6)
          };
        }

        const loginModeState = ensureAccountLoginMode(phoneInputPlan.mode);

        if (!loginModeState.ready) {
          const loginModeStatus = normalizeText(loginModeState.status).toLowerCase();

          if (loginModeStatus === 'missing-email-login-mode') {
            return {
              status: loginModeStatus,
              phoneInputMode: phoneInputPlan.mode,
              helperVersion,
              authConfigSource: normalizeText(effectiveAuthConfig && effectiveAuthConfig.authConfigSource),
              resolvedAccountType: normalizeText(effectiveAccountIdentity && effectiveAccountIdentity.accountType),
              resolvedAccountValuePreview: maskText(accountValue, 6),
              message: '\u672A\u627E\u5230\u90AE\u7BB1\u767B\u5F55\u5361\u7247\uFF0C\u5DF2\u505C\u6B62\u81EA\u52A8\u767B\u5F55\u3002',
              diagnostics: {
                ...getFieldDiagnostics(
                  findAccountInput(document.getElementById('passwordId'), {
                    targetMode: phoneInputPlan.mode
                  }) || document.getElementById('userEmailId') || document.getElementById('usernameId'),
                  document.getElementById('passwordId')
                ),
                loginMode: loginModeState.diagnostics || getLoginModeDiagnostics()
              }
            };
          }

          return {
            status: 'pending-login-mode',
            loginModeStatus: loginModeState.status,
            phoneInputMode: phoneInputPlan.mode,
            helperVersion,
            authConfigSource: normalizeText(effectiveAuthConfig && effectiveAuthConfig.authConfigSource),
            resolvedAccountType: normalizeText(effectiveAccountIdentity && effectiveAccountIdentity.accountType),
            resolvedAccountValuePreview: maskText(accountValue, 6),
            diagnostics: {
              ...getFieldDiagnostics(
                findAccountInput(document.getElementById('passwordId'), {
                  targetMode: phoneInputPlan.mode
                }) || document.getElementById('userEmailId') || document.getElementById('usernameId'),
                document.getElementById('passwordId')
              ),
              loginMode: loginModeState.diagnostics || getLoginModeDiagnostics()
            }
          };
        }

        let passwordInput = findPasswordInput();
        let accountInput = findAccountInput(passwordInput, {
          targetMode: phoneInputPlan.mode
        });

        if (!passwordInput || !accountInput) {
          const diagnosticsAccountInput = accountInput || document.getElementById('userEmailId') || document.getElementById('usernameId');
          const diagnosticsPasswordInput = passwordInput || document.getElementById('passwordId');

          if (hasVisibleVerificationChallenge()) {
            return {
              status: 'verification-required',
              phoneInputMode: phoneInputPlan.mode,
              helperVersion,
              authConfigSource: normalizeText(effectiveAuthConfig && effectiveAuthConfig.authConfigSource),
              resolvedAccountType: normalizeText(effectiveAccountIdentity && effectiveAccountIdentity.accountType),
              resolvedAccountValuePreview: maskText(accountValue, 6),
              diagnostics: getFieldDiagnostics(diagnosticsAccountInput, diagnosticsPasswordInput)
            };
          }

          return {
            status: 'missing-input',
            phoneInputMode: phoneInputPlan.mode,
            helperVersion,
            authConfigSource: normalizeText(effectiveAuthConfig && effectiveAuthConfig.authConfigSource),
            resolvedAccountType: normalizeText(effectiveAccountIdentity && effectiveAccountIdentity.accountType),
            resolvedAccountValuePreview: maskText(accountValue, 6),
            diagnostics: getFieldDiagnostics(diagnosticsAccountInput, diagnosticsPasswordInput)
          };
        }

        if (shouldUseHongKongRegion(accountValue) && !ensureHongKongRegion()) {
          return {
            status: 'pending-region',
            phoneInputMode: phoneInputPlan.mode,
            phoneInputValue: phoneInputPlan.inputValue,
            helperVersion,
            authConfigSource: normalizeText(effectiveAuthConfig && effectiveAuthConfig.authConfigSource),
            resolvedAccountType: normalizeText(effectiveAccountIdentity && effectiveAccountIdentity.accountType),
            resolvedAccountValuePreview: maskText(accountValue, 6),
            diagnostics: getFieldDiagnostics(accountInput, passwordInput)
          };
        }

        writeSavedAuthConfig(effectiveAuthConfig);

        const isEmailMode = phoneInputPlan.mode === 'email';
        const expectedAccountValue = isEmailMode
          ? phoneInputPlan.inputValue
          : normalizeDigits(phoneInputPlan.inputValue);
        const expectedPasswordValue = normalizeText(effectiveAuthConfig.loginPassword);
        const accountStateBefore = getComparablePhoneState();
        const passwordStateBefore = getComparablePasswordState();
        const domAccountBefore = isEmailMode
          ? getInputComparableValue(accountInput, 'text')
          : getInputComparableValue(accountInput, 'digits');
        const domPasswordBefore = getInputComparableValue(passwordInput, 'text');
        const regionAreaCode = accountStateBefore.areaCode;

        let accountFillMethod = '';
        let passwordFillMethod = '';

        if (domAccountBefore !== expectedAccountValue || (
          accountStateBefore.bindingFound
          && (isEmailMode
            ? accountStateBefore.email !== expectedAccountValue
            : accountStateBefore.phone !== expectedAccountValue
          )
        )) {
          const reactApplied = isEmailMode
            ? applyReactAccountState({email: phoneInputPlan.inputValue})
            : applyReactAccountValue(phoneInputPlan.inputValue, regionAreaCode);
          const domApplied = applyDomValue(accountInput, phoneInputPlan.inputValue);

          if (reactApplied) {
            accountFillMethod = 'react+dom';
          } else if (domApplied) {
            accountFillMethod = 'dom';
          }
        } else {
          accountFillMethod = 'already-matched';
        }

        passwordInput = findPasswordInput() || passwordInput;
        accountInput = findAccountInput(passwordInput, {
          targetMode: phoneInputPlan.mode
        }) || accountInput;

        if (
          passwordInput
          && (
            domPasswordBefore !== expectedPasswordValue
            || (
              passwordStateBefore.bindingFound
              && passwordStateBefore.value !== expectedPasswordValue
            )
          )
        ) {
          activateInputField(passwordInput);
        }

        if (domPasswordBefore !== expectedPasswordValue || (
          passwordStateBefore.bindingFound
          && passwordStateBefore.value !== expectedPasswordValue
        )) {
          const reactApplied = applyReactPasswordValue(expectedPasswordValue);
          const domApplied = applyDomValue(passwordInput, expectedPasswordValue);

          if (reactApplied) {
            passwordFillMethod = 'react+dom';
          } else if (domApplied) {
            passwordFillMethod = 'dom';
          }
        } else {
          passwordFillMethod = 'already-matched';
        }

        passwordInput = findPasswordInput() || passwordInput;
        accountInput = findAccountInput(passwordInput, {
          targetMode: phoneInputPlan.mode
        }) || accountInput;

        const accountStateAfter = getComparablePhoneState();
        const passwordStateAfter = getComparablePasswordState();
        const filledAccount = (
          (isEmailMode
            ? getInputComparableValue(accountInput, 'text') === expectedAccountValue
            : getInputComparableValue(accountInput, 'digits') === expectedAccountValue
          )
          && (
            !accountStateAfter.bindingFound
            || (isEmailMode
              ? accountStateAfter.email === expectedAccountValue
              : accountStateAfter.phone === expectedAccountValue
            )
          )
        );
        const filledPassword = (
          getInputComparableValue(passwordInput, 'text') === expectedPasswordValue
          && (
            !passwordStateAfter.bindingFound
            || passwordStateAfter.value === expectedPasswordValue
          )
        );
        const diagnostics = {
          ...getFieldDiagnostics(accountInput, passwordInput),
          helperVersion,
          phoneInputMode: phoneInputPlan.mode,
          authConfigSource: normalizeText(effectiveAuthConfig && effectiveAuthConfig.authConfigSource),
          resolvedAccountType: normalizeText(effectiveAccountIdentity && effectiveAccountIdentity.accountType),
          resolvedAccountValuePreview: maskText(accountValue, 6),
          accountFillMethod,
          passwordFillMethod
        };

        if (!filledAccount || !filledPassword) {
          return {
            status: 'pending-fill',
            filledAccount,
            filledPassword,
            phoneInputMode: phoneInputPlan.mode,
            helperVersion,
            authConfigSource: normalizeText(effectiveAuthConfig && effectiveAuthConfig.authConfigSource),
            resolvedAccountType: normalizeText(effectiveAccountIdentity && effectiveAccountIdentity.accountType),
            resolvedAccountValuePreview: maskText(accountValue, 6),
            diagnostics
          };
        }

        if (hasVisibleVerificationChallenge()) {
          return {
            status: 'verification-required',
            filledAccount,
            filledPassword,
            phoneInputMode: phoneInputPlan.mode,
            helperVersion,
            authConfigSource: normalizeText(effectiveAuthConfig && effectiveAuthConfig.authConfigSource),
            resolvedAccountType: normalizeText(effectiveAccountIdentity && effectiveAccountIdentity.accountType),
            resolvedAccountValuePreview: maskText(accountValue, 6),
            diagnostics
          };
        }

        const activityHomeRequiredMessage = findActivityHomeRequiredMessage();

        if (activityHomeRequiredMessage) {
          return {
            status: 'activity-home-required',
            filledAccount,
            filledPassword,
            phoneInputMode: phoneInputPlan.mode,
            helperVersion,
            authConfigSource: normalizeText(effectiveAuthConfig && effectiveAuthConfig.authConfigSource),
            resolvedAccountType: normalizeText(effectiveAccountIdentity && effectiveAccountIdentity.accountType),
            resolvedAccountValuePreview: maskText(accountValue, 6),
            message: activityHomeRequiredMessage,
            diagnostics
          };
        }

        const agreementResult = ensureAgreementAccepted();

        if (!agreementResult.accepted) {
          return {
            status: 'pending-agreement',
            filledAccount,
            filledPassword,
            phoneInputMode: phoneInputPlan.mode,
            helperVersion,
            authConfigSource: normalizeText(effectiveAuthConfig && effectiveAuthConfig.authConfigSource),
            resolvedAccountType: normalizeText(effectiveAccountIdentity && effectiveAccountIdentity.accountType),
            resolvedAccountValuePreview: maskText(accountValue, 6),
            diagnostics
          };
        }

        if (agreementResult.changed === true) {
          return {
            status: 'pending-submit',
            filledAccount,
            filledPassword,
            phoneInputMode: phoneInputPlan.mode,
            helperVersion,
            authConfigSource: normalizeText(effectiveAuthConfig && effectiveAuthConfig.authConfigSource),
            resolvedAccountType: normalizeText(effectiveAccountIdentity && effectiveAccountIdentity.accountType),
            resolvedAccountValuePreview: maskText(accountValue, 6),
            waitMs: agreementWarmupMs,
            agreementChanged: true,
            diagnostics
          };
        }

        const submitPreparation = ensureSubmitPreparationReady(accountInput, passwordInput, {
          accountMode: isEmailMode ? 'text' : 'digits',
          fieldChanged:
            accountFillMethod !== 'already-matched'
            || passwordFillMethod !== 'already-matched',
          agreementChanged: agreementResult.changed === true
        });

        if (!submitPreparation.ready) {
          return {
            status: 'pending-submit',
            filledAccount,
            filledPassword,
            phoneInputMode: phoneInputPlan.mode,
            helperVersion,
            authConfigSource: normalizeText(effectiveAuthConfig && effectiveAuthConfig.authConfigSource),
            resolvedAccountType: normalizeText(effectiveAccountIdentity && effectiveAccountIdentity.accountType),
            resolvedAccountValuePreview: maskText(accountValue, 6),
            waitMs: submitPreparation.waitMs,
            diagnostics
          };
        }

        const submitButton = findSubmitButton();

        if (!submitButton || isElementDisabled(submitButton)) {
          return {
            status: 'missing-submit',
            filledAccount,
            filledPassword,
            phoneInputMode: phoneInputPlan.mode,
            helperVersion,
            authConfigSource: normalizeText(effectiveAuthConfig && effectiveAuthConfig.authConfigSource),
            resolvedAccountType: normalizeText(effectiveAccountIdentity && effectiveAccountIdentity.accountType),
            resolvedAccountValuePreview: maskText(accountValue, 6),
            diagnostics
          };
        }

        if (getHintText(submitButton).includes('\\u767b\\u5f55\\u4e2d')) {
          return {
            status: 'submitting',
            filledAccount,
            filledPassword,
            phoneInputMode: phoneInputPlan.mode,
            helperVersion,
            authConfigSource: normalizeText(effectiveAuthConfig && effectiveAuthConfig.authConfigSource),
            resolvedAccountType: normalizeText(effectiveAccountIdentity && effectiveAccountIdentity.accountType),
            resolvedAccountValuePreview: maskText(accountValue, 6),
            diagnostics
          };
        }

        const submitGuard = getActiveSubmitGuard(accountInput, passwordInput);

        if (submitGuard.active) {
          const agreementConfirmButton = findLoginAgreementConfirmButton();

          if (agreementConfirmButton && !isElementDisabled(agreementConfirmButton)) {
            triggerPointerClick(agreementConfirmButton);
            return {
              status: 'submitted',
              filledAccount,
              filledPassword,
              phoneInputMode: phoneInputPlan.mode,
              helperVersion,
              authConfigSource: normalizeText(effectiveAuthConfig && effectiveAuthConfig.authConfigSource),
              resolvedAccountType: normalizeText(effectiveAccountIdentity && effectiveAccountIdentity.accountType),
              resolvedAccountValuePreview: maskText(accountValue, 6),
              clickedAgreementConfirm: true,
              diagnostics
            };
          }

          return {
            status: 'submitting',
            filledAccount,
            filledPassword,
            phoneInputMode: phoneInputPlan.mode,
            helperVersion,
            authConfigSource: normalizeText(effectiveAuthConfig && effectiveAuthConfig.authConfigSource),
            resolvedAccountType: normalizeText(effectiveAccountIdentity && effectiveAccountIdentity.accountType),
            resolvedAccountValuePreview: maskText(accountValue, 6),
            remainingMs: submitGuard.remainingMs,
            diagnostics
          };
        }

        triggerPointerClick(submitButton);
        markSubmitGuardSubmitted(accountInput, passwordInput);

        return {
          status: 'submitted',
          filledAccount,
          filledPassword,
          phoneInputMode: phoneInputPlan.mode,
          helperVersion,
          authConfigSource: normalizeText(effectiveAuthConfig && effectiveAuthConfig.authConfigSource),
          resolvedAccountType: normalizeText(effectiveAccountIdentity && effectiveAccountIdentity.accountType),
          resolvedAccountValuePreview: maskText(accountValue, 6),
          diagnostics
        };
      }

      if (!window[runningStateKey]) {
        window[runningStateKey] = {
          running: false
        };
      }

      if (window[runningStateKey].running) {
        return Promise.resolve({
          status: 'busy'
        });
      }

      window[runningStateKey].running = true;

      return new Promise((resolve) => {
        let attemptCount = 0;
        let intervalId = 0;

        const finish = (result) => {
          if (intervalId) {
            window.clearInterval(intervalId);
            intervalId = 0;
          }

          window[runningStateKey].running = false;
          resolve(result);
        };

        const executeAttempt = () => {
          attemptCount += 1;
          let result = null;

          try {
            result = runAutofillAttempt();
          } catch (error) {
            finish({
              status: 'runtime-error',
              message: normalizeText(error && error.message),
              stack: limitText(normalizeText(error && error.stack), 1200),
              attempts: attemptCount
            });
            return;
          }

          if (
            result.status === 'submitted'
            || result.status === 'submitting'
            || result.status === 'authorization-confirm-clicked'
            || result.status === 'pending-authorization'
            || result.status === 'activity-home-required'
            || result.status === 'otp-required'
            || result.status === 'verification-required'
            || result.status === 'missing-email-login-mode'
            || normalizeText(result.loginModeStatus).toLowerCase() === 'missing-email-login-mode'
            || result.status === 'runtime-error'
            || result.status === 'missing-auth'
            || attemptCount >= retryLimit
          ) {
            finish({
              ...result,
              helperVersion: normalizeText(result && result.helperVersion) || helperVersion,
              attempts: attemptCount
            });
          }
        };

        executeAttempt();

        if (window[runningStateKey].running) {
          intervalId = window.setInterval(executeAttempt, retryIntervalMs);
        }
      });
    })();
  `;
}

function buildLoginPageDebugSnapshotScript() {
  return `
    (() => {
      function normalizeText(value) {
        return String(value || '').trim();
      }

      function limitText(value, maxLength) {
        const normalizedValue = normalizeText(value);
        const limit = Number(maxLength) || 0;

        if (!normalizedValue || limit <= 0 || normalizedValue.length <= limit) {
          return normalizedValue;
        }

        return normalizedValue.slice(0, limit);
      }

      function isVisible(element) {
        if (!(element instanceof HTMLElement)) {
          return false;
        }

        if (element.hidden || element.hasAttribute('hidden')) {
          return false;
        }

        const style = window.getComputedStyle(element);

        if (!style || style.display === 'none' || style.visibility === 'hidden') {
          return false;
        }

        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function maskValue(value) {
        const normalizedValue = normalizeText(value);

        if (!normalizedValue) {
          return '';
        }

        if (normalizedValue.length <= 4) {
          return normalizedValue;
        }

        return '*'.repeat(Math.max(0, normalizedValue.length - 4)) + normalizedValue.slice(-4);
      }

      function describeElement(element) {
        if (!element || !(element instanceof HTMLElement)) {
          return null;
        }

        const rect = element.getBoundingClientRect();
        const rawValue = normalizeText('value' in element ? element.value : '');

        return {
          tagName: normalizeText(element.tagName).toLowerCase(),
          id: normalizeText(element.id),
          name: normalizeText(element.name),
          type: normalizeText(element.type).toLowerCase(),
          inputMode: normalizeText(element.inputMode).toLowerCase(),
          placeholder: normalizeText(element.placeholder),
          className: limitText(normalizeText(element.className), 160),
          text: limitText(normalizeText(element.textContent), 120),
          valueLength: rawValue.length,
          valuePreview: maskValue(rawValue),
          disabled: Boolean('disabled' in element && element.disabled === true),
          readOnly: Boolean('readOnly' in element && element.readOnly === true),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      }

      function collectVisible(selector, limit) {
        return Array.from(document.querySelectorAll(selector))
          .filter((element) => isVisible(element))
          .slice(0, Number(limit) || 0)
          .map((element) => describeElement(element));
      }

      function collectLoginModeButtons() {
        const modePatterns = [
          /account\\s*password\\s*login/i,
          /account\\s*login/i,
          /email\\s*login/i,
          /email/i,
          /password\\s*login/i,
          /sms\\s*login/i,
          /code\\s*login/i,
          /otp/i,
          /scan\\s*(qr|code)\\s*login/i,
          /qr\\s*login/i,
          /scan\\s*login/i,
          /\\u8d26\\u53f7\\u5bc6\\u7801\\u767b\\u5f55/u,
          /\\u8d26\\u53f7\\u767b\\u5f55/u,
          /\\u90ae\\u7bb1/u,
          /\\u5bc6\\u7801\\u767b\\u5f55/u,
          /\\u626b\\u7801\\u767b\\u5f55/u,
          /\\u9a8c\\u8bc1\\u7801\\u767b\\u5f55/u,
          /\\u77ed\\u4fe1\\u767b\\u5f55/u
        ];
        const seen = new Set();

        return Array.from(document.querySelectorAll('button, [role="tab"], [role="button"], a, label, [aria-selected], [aria-pressed]'))
          .filter((element) => isVisible(element))
          .filter((element) => {
            if (seen.has(element)) {
              return false;
            }

            seen.add(element);
            const text = [
              normalizeText(element.textContent),
              normalizeText(element.getAttribute('aria-label')),
              normalizeText(element.getAttribute('title'))
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();

            return modePatterns.some((pattern) => pattern.test(text));
          })
          .slice(0, 8)
          .map((element) => ({
            ...describeElement(element),
            text: limitText(normalizeText(element.textContent), 80),
            ariaSelected: normalizeText(element.getAttribute('aria-selected')).toLowerCase(),
            ariaPressed: normalizeText(element.getAttribute('aria-pressed')).toLowerCase()
          }));
      }

      function collectAgreementCandidates() {
        const agreementPatterns = [
          /\\u6388\\u6743/u,
          /\\u9690\\u79c1\\u653f\\u7b56/u,
          /\\u5171\\u4eab/u,
          /account\\s*id/i,
          /seller\\s*center/i,
          /temu/i
        ];

        return Array.from(document.querySelectorAll('label, div, span, p, section'))
          .filter((element) => isVisible(element))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            const text = normalizeText(element.innerText || element.textContent);

            return {
              element,
              text,
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            };
          })
          .filter((entry) => (
            entry.text
            && entry.text.length <= 260
            && entry.width > 40
            && entry.height > 10
            && agreementPatterns.some((pattern) => pattern.test(entry.text))
          ))
          .slice(0, 8)
          .map((entry) => ({
            ...describeElement(entry.element),
            text: limitText(entry.text, 160)
          }));
      }

      function getHtmlPreview(elementId) {
        const element = document.getElementById(elementId);

        if (!element) {
          return '';
        }

        return limitText(element.outerHTML || element.innerHTML || '', 1600);
      }

        return {
          href: normalizeText(window.location.href),
          title: normalizeText(document.title),
          readyState: normalizeText(document.readyState),
          accountRoot: describeElement(document.getElementById('userEmailId') || document.getElementById('usernameId')),
          emailRoot: describeElement(document.getElementById('userEmailId')),
          usernameRoot: describeElement(document.getElementById('usernameId')),
          passwordRoot: describeElement(document.getElementById('passwordId')),
          accountRootText: limitText(normalizeText((document.getElementById('userEmailId') || document.getElementById('usernameId')) && (document.getElementById('userEmailId') || document.getElementById('usernameId')).innerText), 300),
          emailRootText: limitText(normalizeText(document.getElementById('userEmailId') && document.getElementById('userEmailId').innerText), 300),
          usernameRootText: limitText(normalizeText(document.getElementById('usernameId') && document.getElementById('usernameId').innerText), 300),
          passwordRootText: limitText(normalizeText(document.getElementById('passwordId') && document.getElementById('passwordId').innerText), 300),
          accountRootHtml: getHtmlPreview(document.getElementById('userEmailId') ? 'userEmailId' : 'usernameId'),
          emailRootHtml: getHtmlPreview('userEmailId'),
          usernameRootHtml: getHtmlPreview('usernameId'),
          passwordRootHtml: getHtmlPreview('passwordId'),
        visibleInputs: collectVisible('input', 10),
        visibleButtons: collectVisible('button, [role="button"], input[type="submit"]', 10),
        visibleLoginModes: collectLoginModeButtons(),
        visibleAgreementCandidates: collectAgreementCandidates(),
        visibleSelectors: collectVisible('[role="combobox"], [aria-haspopup="listbox"], [aria-haspopup="menu"], select', 8),
        bodyTextPreview: limitText(normalizeText(document.body && document.body.innerText), 1200)
      };
    })();
  `;
}

function stripTrailingSemicolon(script) {
  return String(script || '').trim().replace(/;+\s*$/, '');
}

function buildNormalizedAuthConfigPayload(authConfig) {
  const accountIdentity = resolveAccountIdentity(authConfig);

  return {
    phoneNumber: accountIdentity.phoneNumber,
    email: accountIdentity.email,
    accountValue: accountIdentity.accountValue,
    accountType: accountIdentity.accountType,
    loginPassword: normalizeText(authConfig && authConfig.loginPassword)
  };
}

function buildLoginAutofillHelperSignature(authConfig) {
  const scriptSource = buildLoginAutofillScript(authConfig);
  return crypto.createHash('sha1')
    .update(JSON.stringify({
      version: LOGIN_AUTOFILL_HELPER_VERSION,
      auth: buildNormalizedAuthConfigPayload(authConfig),
      scriptSource
    }))
    .digest('hex');
}

function buildEnsureLoginAutofillHelperScript(authConfig) {
  const helperSignature = buildLoginAutofillHelperSignature(authConfig);
  const helperVersion = LOGIN_AUTOFILL_HELPER_VERSION;
  const runExpression = stripTrailingSemicolon(buildLoginAutofillScript(authConfig));
  const snapshotExpression = stripTrailingSemicolon(buildLoginPageDebugSnapshotScript());

  return `
    (() => {
      const helperKey = ${JSON.stringify(LOGIN_AUTOFILL_HELPER_KEY)};
      const helperSignature = ${JSON.stringify(helperSignature)};
      const helperVersion = ${JSON.stringify(helperVersion)};
      const currentHelper = window[helperKey];

      if (
        currentHelper
        && currentHelper.signature === helperSignature
        && currentHelper.version === helperVersion
        && typeof currentHelper.run === 'function'
        && typeof currentHelper.getDebugSnapshot === 'function'
      ) {
        return {
          installed: true,
          updated: false,
          signature: helperSignature
        };
      }

      window[helperKey] = {
        signature: helperSignature,
        version: helperVersion,
        run() {
          return ${runExpression};
        },
        getDebugSnapshot() {
          return ${snapshotExpression};
        }
      };

      return {
        installed: true,
        updated: true,
        signature: helperSignature
      };
    })();
  `;
}

function buildIsLoginAutofillHelperReadyScript() {
  return `
    (() => {
      const helper = window[${JSON.stringify(LOGIN_AUTOFILL_HELPER_KEY)}];

      return Boolean(
        helper
        && typeof helper.run === 'function'
        && typeof helper.getDebugSnapshot === 'function'
      );
    })();
  `;
}

function buildRunInstalledLoginAutofillScript() {
  return `
    (() => {
      const helper = window[${JSON.stringify(LOGIN_AUTOFILL_HELPER_KEY)}];

      if (!helper || typeof helper.run !== 'function') {
        return {
          status: 'helper-missing'
        };
      }

      return helper.run();
    })();
  `;
}

function buildCollectInstalledLoginDebugSnapshotScript() {
  return `
    (() => {
      const helper = window[${JSON.stringify(LOGIN_AUTOFILL_HELPER_KEY)}];

      if (!helper || typeof helper.getDebugSnapshot !== 'function') {
        return null;
      }

      return helper.getDebugSnapshot();
    })();
  `;
}

module.exports = {
  hasCompleteAuthConfig,
  isLoginAutofillUrl,
  buildLoginAutofillScript,
  buildLoginPageDebugSnapshotScript,
  buildLoginAutofillHelperSignature,
  buildEnsureLoginAutofillHelperScript,
  buildIsLoginAutofillHelperReadyScript,
  buildRunInstalledLoginAutofillScript,
  buildCollectInstalledLoginDebugSnapshotScript
};
