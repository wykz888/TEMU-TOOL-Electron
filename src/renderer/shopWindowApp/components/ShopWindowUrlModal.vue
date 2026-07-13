<template>
  <div
    id="shopWindowUrlModal"
    class="modal-shell"
    :hidden="!state.visible"
  >
    <div class="modal-backdrop" aria-hidden="true"></div>
    <section
      class="modal-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shopWindowUrlModalTitle"
    >
      <header class="modal-header">
        <div>
          <p class="panel-label">&#x6D4F;&#x89C8;&#x5668;&#x7F51;&#x5740;</p>
          <h3 id="shopWindowUrlModalTitle" class="modal-title">&#x65B0;&#x5EFA;&#x7F51;&#x5740;</h3>
        </div>
        <button
          class="icon-button"
          type="button"
          aria-label="&#x5173;&#x95ED;"
          @click="close"
        >
          &#x2715;
        </button>
      </header>

      <p
        id="shopWindowUrlModalStatus"
        class="modal-status"
        :hidden="!state.status"
      >
        {{ state.status }}
      </p>

      <form id="shopWindowUrlForm" class="modal-form" @submit.prevent="handleSubmit">
        <div class="modal-grid modal-grid-single">
          <label class="field-shell" for="shopWindowUrlInput">
            <span class="field-label">&#x8F93;&#x5165;&#x7F51;&#x5740;</span>
            <input
              id="shopWindowUrlInput"
              ref="urlInputRef"
              v-model="state.url"
              class="field-input"
              type="text"
              inputmode="url"
              autocomplete="off"
              placeholder="https://ads.temu.com/"
            />
          </label>
        </div>
        <p class="shop-window-url-modal-tip">&#x6309; F7 &#x53EF;&#x5FEB;&#x901F;&#x6253;&#x5F00;&#x8FD9;&#x91CC;&#xFF0C;&#x652F;&#x6301; `https://`&#xFF0C;&#x63D0;&#x4EA4;&#x540E;&#x4F1A;&#x65B0;&#x5EFA;&#x6807;&#x7B7E;&#x5E76;&#x81EA;&#x52A8;&#x8DF3;&#x8F6C;&#x3002;</p>
        <div class="modal-actions">
          <button class="secondary-button" type="button" @click="close">
            &#x53D6;&#x6D88;
          </button>
          <button class="primary-inline-button" type="submit" :disabled="state.busy">
            <span v-if="state.busy">&#x8DF3;&#x8F6C;&#x4E2D;...</span>
            <span v-else>&#x65B0;&#x5EFA;&#x8DF3;&#x8F6C;</span>
          </button>
        </div>
      </form>
    </section>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

const urlInputRef = ref(null);
const state = reactive({
  visible: false,
  busy: false,
  status: '',
  url: '',
  context: null
});
const runtime = {
  openBrowserUrlInNewTab: null,
  onOpenStateChange: null,
  showTabStatus: null
};

function normalizeText(value) {
  return value == null ? '' : String(value).trim();
}

function normalizeModalContext(payload) {
  return {
    shopId: normalizeText(payload && payload.shopId),
    pageType: normalizeText(payload && payload.pageType),
    browserTabId: normalizeText(payload && payload.browserTabId),
    currentUrl: normalizeText(payload && payload.currentUrl)
  };
}

function syncModalOpenState() {
  document.body.classList.toggle('modal-open', state.visible);

  if (typeof runtime.onOpenStateChange === 'function') {
    runtime.onOpenStateChange(state.visible);
  }
}

function focusUrlInput() {
  window.requestAnimationFrame(() => {
    if (!state.visible || !urlInputRef.value) {
      return;
    }

    urlInputRef.value.focus();
    urlInputRef.value.select();
  });
}

function configure(options = {}) {
  runtime.openBrowserUrlInNewTab =
    typeof options.openBrowserUrlInNewTab === 'function'
      ? options.openBrowserUrlInNewTab
      : null;
  runtime.onOpenStateChange =
    typeof options.onOpenStateChange === 'function'
      ? options.onOpenStateChange
      : null;
  runtime.showTabStatus =
    typeof options.showTabStatus === 'function'
      ? options.showTabStatus
      : null;
}

async function open(payload) {
  state.context = normalizeModalContext(payload);
  state.url = state.context.currentUrl || 'https://';
  state.status = '';
  state.busy = false;
  state.visible = true;
  syncModalOpenState();
  await nextTick();
  focusUrlInput();
}

function close() {
  state.context = null;
  state.visible = false;
  state.status = '';
  state.busy = false;
  syncModalOpenState();
}

async function handleSubmit() {
  if (!state.context) {
    state.status = '\u5f53\u524d\u6ca1\u6709\u53ef\u7528\u7684\u6d4f\u89c8\u5668\u6807\u7b7e\u3002';
    return;
  }

  const rawUrl = normalizeText(state.url);

  if (!rawUrl) {
    state.status = '\u8bf7\u8f93\u5165\u8981\u8df3\u8f6c\u7684\u7f51\u5740\u3002';
    focusUrlInput();
    return;
  }

  if (typeof runtime.openBrowserUrlInNewTab !== 'function') {
    state.status = '\u539f\u751f\u6d4f\u89c8\u5668\u901a\u4fe1\u6a21\u5757\u52a0\u8f7d\u5931\u8d25\u3002';
    return;
  }

  state.status = '';
  state.busy = true;

  try {
    const result = await runtime.openBrowserUrlInNewTab({
      ...state.context,
      url: rawUrl
    });

    close();

    if (typeof runtime.showTabStatus === 'function') {
      runtime.showTabStatus({
        message:
          result && result.openedInCurrentTab === true
            ? '\u5df2\u8fbe\u5230\u6807\u7b7e\u4e0a\u9650\uff0c\u5df2\u5728\u5f53\u524d\u6807\u7b7e\u6253\u5f00\u65b0\u7f51\u5740\u3002'
            : '\u5df2\u65b0\u5efa\u6807\u7b7e\u5e76\u5f00\u59cb\u8df3\u8f6c\u7f51\u5740\u3002',
        durationMs: 2600
      });
    }
  } catch (error) {
    state.busy = false;
    state.status = error && error.message
      ? error.message
      : '\u7f51\u5740\u8df3\u8f6c\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002';
  }
}

function handleWindowKeydown(event) {
  if (event.key !== 'Escape' || !state.visible) {
    return;
  }

  event.preventDefault();
  close();
}

function isOpen() {
  return state.visible;
}

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowKeydown);
  document.body.classList.remove('modal-open');
});

defineExpose({
  close,
  configure,
  isOpen,
  open
});
</script>
