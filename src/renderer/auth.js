import { onDomReady } from './modules/domReady.js';

const state = {
  mode: 'login',
  busy: false
};

function normalizeErrorMessage(error, fallbackMessage) {
  const raw = (error && typeof error.message === 'string' && error.message.trim())
    ? error.message.trim()
    : '';

  if (!raw) {
    return fallbackMessage;
  }

  if (/[\u4e00-\u9fff]/u.test(raw)) {
    return raw;
  }

  if (/Cannot read properties of undefined/i.test(raw) || /is not defined/i.test(raw)) {
    return '\u754c\u9762\u6a21\u5757\u52a0\u8f7d\u4e0d\u5b8c\u6574\uff0c\u8bf7\u5173\u95ed\u8f6f\u4ef6\u540e\u91cd\u65b0\u6253\u5f00\u3002';
  }

  if (/Unexpected token/i.test(raw) || /Unexpected identifier/i.test(raw)) {
    return '\u754c\u9762\u811a\u672c\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u5173\u95ed\u8f6f\u4ef6\u540e\u91cd\u65b0\u6253\u5f00\u3002';
  }

  if (/session/i.test(raw) || /partition/i.test(raw) || /IPC/i.test(raw) || /electron/i.test(raw) || /preload/i.test(raw)) {
    return fallbackMessage;
  }

  if (/ERR_CONNECTION/i.test(raw) || /ECONNREFUSED/i.test(raw) || /ETIMEDOUT/i.test(raw) || /ENOTFOUND/i.test(raw)) {
    return '\u7f51\u7edc\u8fde\u63a5\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u540e\u91cd\u8bd5\u3002';
  }

  if (/protocol/i.test(raw)) {
    return fallbackMessage;
  }

  return fallbackMessage;
}

function getAuthBridge() {
  if (window.temuApp && window.temuApp.auth) {
    return window.temuApp.auth;
  }

  throw new Error('\u7A0B\u5E8F\u901A\u4FE1\u521D\u59CB\u5316\u5931\u8D25\uFF0C\u8BF7\u5173\u95ED\u7A97\u53E3\u540E\u91CD\u65B0\u6253\u5F00\u8F6F\u4EF6\u3002');
}

function getElements() {
  return {
    loginTab: document.getElementById('loginTab'),
    registerTab: document.getElementById('registerTab'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    loginSubmit: document.getElementById('loginSubmit'),
    registerSubmit: document.getElementById('registerSubmit'),
    statusText: document.getElementById('statusText'),
    rememberLogin: document.getElementById('rememberLogin')
  };
}

function setStatus(message, type = 'default') {
  const { statusText } = getElements();

  statusText.textContent = message;
  statusText.classList.remove('is-error', 'is-success');

  if (type === 'error') {
    statusText.classList.add('is-error');
  }

  if (type === 'success') {
    statusText.classList.add('is-success');
  }
}

function setBusy(nextBusy) {
  state.busy = nextBusy;

  const { loginTab, registerTab, loginSubmit, registerSubmit, rememberLogin } = getElements();

  loginTab.disabled = nextBusy;
  registerTab.disabled = nextBusy;
  loginSubmit.disabled = nextBusy;
  registerSubmit.disabled = nextBusy;
  rememberLogin.disabled = nextBusy;
}

function switchMode(nextMode) {
  state.mode = nextMode;

  const { loginTab, registerTab, loginForm, registerForm } = getElements();
  const isLogin = nextMode === 'login';

  loginTab.classList.toggle('is-active', isLogin);
  registerTab.classList.toggle('is-active', !isLogin);
  loginForm.classList.toggle('is-hidden', !isLogin);
  registerForm.classList.toggle('is-hidden', isLogin);
  setStatus('');
}

async function loadCachedLoginAccount(authBridge) {
  let cachedAccount = null;

  try {
    cachedAccount = await authBridge.getCachedLoginAccount();
  } catch (_error) {
    return;
  }

  if (!cachedAccount) {
    return;
  }

  const loginUsernameInput = document.getElementById('loginUsername');
  const loginPasswordInput = document.getElementById('loginPassword');
  const rememberLoginInput = document.getElementById('rememberLogin');

  if (cachedAccount.username && !loginUsernameInput.value) {
    loginUsernameInput.value = cachedAccount.username;
  }

  if (cachedAccount.rememberLogin === true) {
    rememberLoginInput.checked = true;
    loginPasswordInput.value = cachedAccount.password || '';
  }
}

async function handleLogin(event) {
  event.preventDefault();

  if (state.busy) {
    return;
  }

  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  const rememberLogin = document.getElementById('rememberLogin').checked;

  setBusy(true);
  setStatus('\u6b63\u5728\u9a8c\u8bc1\u8d26\u53f7\u2026');

  try {
    await getAuthBridge().login({
      username,
      password,
      rememberLogin
    });

    setStatus('\u767b\u5f55\u6210\u529f\uff0c\u6b63\u5728\u6253\u5f00\u4e3b\u7a97\u53e3\u2026', 'success');
  } catch (error) {
    setStatus(normalizeErrorMessage(error, '\u767b\u5f55\u5931\u8d25\u3002'), 'error');
  } finally {
    setBusy(false);
  }
}

async function handleRegister(event) {
  event.preventDefault();

  if (state.busy) {
    return;
  }

  const username = document.getElementById('registerUsername').value;
  const password = document.getElementById('registerPassword').value;
  const confirmPassword = document.getElementById('registerConfirmPassword').value;

  setBusy(true);
  setStatus('\u6b63\u5728\u521b\u5efa\u8d26\u53f7\u2026');

  try {
    await getAuthBridge().register({
      username,
      password,
      confirmPassword
    });

    document.getElementById('loginUsername').value = username;
    document.getElementById('loginPassword').value = '';
    document.getElementById('registerForm').reset();
    switchMode('login');
    setStatus('\u6ce8\u518c\u6210\u529f\uff0c\u8bf7\u4f7f\u7528\u65b0\u8d26\u53f7\u767b\u5f55\u3002', 'success');
  } catch (error) {
    setStatus(normalizeErrorMessage(error, '\u6ce8\u518c\u5931\u8d25\u3002'), 'error');
  } finally {
    setBusy(false);
  }
}

onDomReady(() => {
  const { loginTab, registerTab, loginForm, registerForm } = getElements();

  loginTab.addEventListener('click', () => switchMode('login'));
  registerTab.addEventListener('click', () => switchMode('register'));
  loginForm.addEventListener('submit', handleLogin);
  registerForm.addEventListener('submit', handleRegister);
  switchMode('login');

  try {
    const authBridge = getAuthBridge();
    void loadCachedLoginAccount(authBridge);
  } catch (error) {
    setStatus(normalizeErrorMessage(error, '\u7A0B\u5E8F\u521D\u59CB\u5316\u5931\u8D25\u3002'), 'error');
    setBusy(true);
  }
});

window.addEventListener('error', (event) => {
  setStatus(
    normalizeErrorMessage(event.error, '\u754C\u9762\u53D1\u751F\u9519\u8BEF\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u8F6F\u4EF6\u3002'),
    'error'
  );
});

window.addEventListener('unhandledrejection', (event) => {
  setStatus(
    normalizeErrorMessage(event.reason, '\u8BF7\u6C42\u5904\u7406\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002'),
    'error'
  );
});
