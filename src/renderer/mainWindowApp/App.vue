<template>
  <div class="main-window-shell">
    <nav class="main-window-shell-card" aria-label="Main Navigation">
      <div class="main-window-shell-overview">
        <div class="main-window-shell-mark">
          <component :is="activeSectionMeta.iconComponent" />
        </div>
        <div class="main-window-shell-overview-copy">
          <strong>&#x5de5;&#x4f5c;&#x53f0;</strong>
          <span>{{ activeSectionMeta.title }}</span>
        </div>
      </div>

      <div class="main-window-shell-center">
        <div class="main-window-shell-nav-strip">
          <a-button
            v-for="section in visibleSections"
            :key="section.id"
            :type="activeSection === section.id ? 'primary' : 'secondary'"
            size="large"
            class="main-window-nav-button"
            @click="setSection(section.id)"
          >
            <template #icon>
              <component :is="section.iconComponent" />
            </template>
            {{ section.title }}
          </a-button>
        </div>
      </div>

      <div class="main-window-shell-right">
        <a-tag
          v-if="statusBadgeText"
          class="main-window-status-tag"
          color="orange"
          bordered
        >
          {{ statusBadgeText }}
        </a-tag>

        <a-button
          type="text"
          class="main-window-session-button"
          :disabled="loadingSession && !session"
        >
          <template #icon>
            <icon-user />
          </template>
          {{ sessionSummaryText }}
        </a-button>

        <a-button
          v-if="session"
          type="text"
          class="main-window-plan-button"
        >
          &#x57fa;&#x7840;&#x7248;
        </a-button>

        <div class="main-window-top-actions">
          <a-tooltip content="&#x5168;&#x5c40;&#x914d;&#x7f6e;">
            <a-button
              class="main-window-icon-button"
              size="small"
              shape="circle"
              @click="openGlobalConfigSection"
            >
              <template #icon>
                <icon-settings />
              </template>
            </a-button>
          </a-tooltip>

          <a-tooltip content="&#x5237;&#x65b0;&#x5f53;&#x524d;&#x533a;&#x57df;">
            <a-button
              class="main-window-icon-button"
              size="small"
              shape="circle"
              :loading="refreshingSection"
              @click="handleRefreshCurrentSection"
            >
              <template #icon>
                <icon-refresh />
              </template>
            </a-button>
          </a-tooltip>

          <a-tooltip v-if="session" content="&#x9000;&#x51fa;">
            <a-button
              class="main-window-icon-button is-danger"
              size="small"
              shape="circle"
              :loading="logoutLoading"
              @click="handleLogout"
            >
              <template #icon>
                <icon-poweroff />
              </template>
            </a-button>
          </a-tooltip>
        </div>
      </div>
    </nav>

    <a-alert
      v-if="runtimeStatus.message"
      type="error"
      show-icon
      class="main-window-runtime-alert"
    >
      <template #title>
        {{ runtimeStatus.title }}
      </template>
      {{ runtimeStatus.message }}
    </a-alert>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import {
  IconApps,
  IconDesktop,
  IconPoweroff,
  IconRefresh,
  IconRobot,
  IconSafe,
  IconSettings,
  IconUser
} from '@arco-design/web-vue/es/icon';
import { getAuthBridge, getThemeBridge } from './bridge';
import { DEFAULT_SECTION_ID, MAIN_WINDOW_SECTIONS } from './constants';

const iconMap = Object.freeze({
  apps: IconApps,
  desktop: IconDesktop,
  robot: IconRobot,
  safe: IconSafe,
  settings: IconSettings
});

const sections = MAIN_WINDOW_SECTIONS.map((section) => ({
  ...section,
  iconComponent: iconMap[section.icon] || IconApps
}));

const activeSection = ref(DEFAULT_SECTION_ID);
const session = ref(null);
const loadingSession = ref(true);
const logoutLoading = ref(false);
const refreshingSection = ref(false);
const runtimeStatus = reactive({
  title: '',
  message: '',
  badgeText: ''
});

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
}

function getCurrentThemeAppearance() {
  if (window.temuTheme && typeof window.temuTheme.getCurrentAppearance === 'function') {
    return window.temuTheme.getCurrentAppearance();
  }

  return null;
}

function applyShellTheme(theme, appearance) {
  const nextTheme = theme === 'dark' ? 'dark' : 'light';
  const nextAppearance = appearance || getCurrentThemeAppearance() || undefined;

  if (window.temuTheme && typeof window.temuTheme.applyTheme === 'function') {
    window.temuTheme.applyTheme(nextTheme, nextAppearance);
    return;
  }

  document.body.classList.toggle('light-frame-theme', nextTheme === 'light');
  document.body.classList.toggle('dark-theme', nextTheme === 'dark');
}

function isKnownSection(sectionId) {
  return sections.some((section) => section.id === sectionId);
}

function updateShopLoginBadge(nextSession) {
  const badge = document.getElementById('shopLoginTimeBadge');

  if (!badge) {
    return;
  }

  if (!nextSession || !nextSession.loggedInAt) {
    badge.hidden = true;
    badge.textContent = '\u6700\u8fd1\u767b\u5f55\u65f6\u95f4\uff1a-';
    return;
  }

  badge.hidden = false;
  badge.textContent = `\u6700\u8fd1\u767b\u5f55\u65f6\u95f4\uff1a${formatDateTime(nextSession.loggedInAt)}`;
}

function applySectionToPanels(sectionId) {
  const nextSectionId = isKnownSection(sectionId) ? sectionId : DEFAULT_SECTION_ID;
  const panels = document.querySelectorAll('[data-section-panel]');

  panels.forEach((panel) => {
    const isActive = panel.id === nextSectionId;
    panel.classList.toggle('is-active', isActive);
    panel.hidden = !isActive;
  });

  activeSection.value = nextSectionId;

  window.dispatchEvent(
    new CustomEvent('app:section-changed', {
      detail: {
        sectionId: nextSectionId
      }
    })
  );
}

function detectInitialSection() {
  const activePanel = Array.from(document.querySelectorAll('[data-section-panel]')).find((panel) => {
    return panel.hidden !== true && panel.classList.contains('is-active');
  });

  return activePanel && activePanel.id ? activePanel.id : DEFAULT_SECTION_ID;
}

function setSection(sectionId) {
  applySectionToPanels(sectionId);
}

function getSectionMeta(sectionId) {
  return sections.find((section) => section.id === sectionId) || sections[0];
}

function getSectionRefreshView(sectionId) {
  if (sectionId === 'shop-management') {
    return window.shopManagementView || null;
  }

  if (sectionId === 'shop-window') {
    return window.shopWindowView || null;
  }

  if (sectionId === 'feature-center') {
    return window.featureCenterView || null;
  }

  if (sectionId === 'creation-center') {
    return window.creationCenterView || null;
  }

  if (sectionId === 'global-config') {
    return window.globalConfigView || null;
  }

  return null;
}

function setSession(nextSession) {
  session.value = nextSession || null;
  loadingSession.value = false;
  updateShopLoginBadge(session.value);
}

function setRuntimeStatus(payload) {
  runtimeStatus.title = payload && payload.title
    ? payload.title
    : '\u754c\u9762\u5f02\u5e38';
  runtimeStatus.message = payload && payload.message
    ? payload.message
    : '\u8bf7\u91cd\u65b0\u542f\u52a8\u8f6f\u4ef6\u3002';
  runtimeStatus.badgeText = payload && payload.badgeText
    ? payload.badgeText
    : '\u5f02\u5e38';
}

function clearRuntimeStatus() {
  runtimeStatus.title = '';
  runtimeStatus.message = '';
  runtimeStatus.badgeText = '';
}

function normalizeUserError(error, fallbackMessage) {
  if (!error || !error.message || !String(error.message).trim()) {
    return fallbackMessage;
  }

  const raw = String(error.message).trim();

  if (/[\u4e00-\u9fff]/u.test(raw)) {
    return raw;
  }

  if (/session/i.test(raw) || /partition/i.test(raw) || /IPC/i.test(raw) || /electron/i.test(raw) || /preload/i.test(raw)) {
    return fallbackMessage;
  }

  if (/ERR_CONNECTION/i.test(raw) || /ECONNREFUSED/i.test(raw) || /ETIMEDOUT/i.test(raw) || /ENOTFOUND/i.test(raw)) {
    return '\u7f51\u7edc\u8fde\u63a5\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u540e\u91cd\u8bd5\u3002';
  }

  return fallbackMessage;
}

async function refreshSession() {
  loadingSession.value = true;

  try {
    const nextSession = await getAuthBridge().getSession();
    setSession(nextSession);
    return nextSession;
  } catch (_error) {
    setSession(null);
    return null;
  }
}

async function syncThemeFromBridge() {
  const themeBridge = getThemeBridge();
  if (!themeBridge) {
    applyShellTheme('light');
    return;
  }

  const [theme, appearance] = await Promise.all([
    typeof themeBridge.getTheme === 'function'
      ? themeBridge.getTheme().catch(() => 'light')
      : Promise.resolve('light'),
    typeof themeBridge.getThemeAppearance === 'function'
      ? themeBridge.getThemeAppearance().catch(() => getCurrentThemeAppearance())
      : Promise.resolve(getCurrentThemeAppearance())
  ]);

  applyShellTheme(theme, appearance);
}

function openGlobalConfigSection() {
  setSection('global-config');
}

async function handleRefreshCurrentSection() {
  if (refreshingSection.value) {
    return;
  }

  const currentSectionId = activeSection.value;
  const currentSectionMeta = getSectionMeta(currentSectionId);
  const refreshView = getSectionRefreshView(currentSectionId);

  refreshingSection.value = true;
  clearRuntimeStatus();

  try {
    await refreshSession();

    if (refreshView && typeof refreshView.refresh === 'function') {
      await refreshView.refresh();
    }

    await syncThemeFromBridge();
    Message.success(`${currentSectionMeta.title}\u5df2\u5237\u65b0`);
  } catch (error) {
    const message = normalizeUserError(error, '\u5f53\u524d\u533a\u57df\u5237\u65b0\u5931\u8d25\u3002');

    setRuntimeStatus({
      title: '\u5237\u65b0\u5931\u8d25',
      message,
      badgeText: '\u5237\u65b0\u5931\u8d25'
    });
    Message.error(message);
  } finally {
    refreshingSection.value = false;
  }
}

async function handleLogout() {
  if (logoutLoading.value) {
    return;
  }

  logoutLoading.value = true;

  try {
    await getAuthBridge().logout();
    setSession(null);
  } finally {
    logoutLoading.value = false;
  }
}

function bindThemeListener() {
  const themeBridge = getThemeBridge();

  if (!themeBridge || typeof themeBridge.onThemeChanged !== 'function') {
    return;
  }

  themeBridge.onThemeChanged((payload) => {
    applyShellTheme(
      payload && payload.theme,
      payload && payload.appearance
    );
  });
}

const sessionSummaryText = computed(() => {
  if (loadingSession.value) {
    return '\u4f1a\u8bdd\u52a0\u8f7d\u4e2d';
  }

  if (session.value && session.value.username) {
    return session.value.username;
  }

  return '\u672a\u767b\u5f55';
});

const statusBadgeText = computed(() => (
  runtimeStatus.message ? runtimeStatus.badgeText : ''
));

const visibleSections = computed(() => (
  sections.filter((section) => section.visible !== false)
));

const activeSectionMeta = computed(() => (
  getSectionMeta(activeSection.value)
));

onMounted(() => {
  clearRuntimeStatus();
  setSection(detectInitialSection());
  bindThemeListener();
  void syncThemeFromBridge();
  void refreshSession();
});

defineExpose({
  clearRuntimeStatus,
  refreshSession,
  handleRefreshCurrentSection,
  openGlobalConfigSection,
  setRuntimeStatus,
  setSection,
  setSession,
  syncThemeFromBridge
});
</script>

<style>
.main-window-shell {
  display: grid;
  gap: 12px;
}

.main-window-shell-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  padding: 12px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}

.main-window-shell-overview,
.main-window-shell-center,
.main-window-shell-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
}

.main-window-shell-overview {
  flex: 0 0 auto;
  padding-right: 4px;
}

.main-window-shell-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.12);
  color: var(--theme-primary-ink, #445468);
  font-size: 18px;
  box-shadow: inset 0 0 0 1px rgba(var(--theme-primary-rgb, 247, 181, 0), 0.16);
}

.main-window-shell-overview-copy {
  display: grid;
  gap: 4px;
}

.main-window-shell-overview-copy strong {
  color: #132238;
  font-size: 15px;
  line-height: 1.2;
}

.main-window-shell-overview-copy span {
  color: #64748b;
  font-size: 12px;
  line-height: 1.2;
}

.main-window-shell-center {
  flex: 1 1 520px;
}

.main-window-shell-nav-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  width: 100%;
  min-width: 0;
  padding: 0;
  background: transparent;
  border: 0;
}

.main-window-shell-right {
  margin-left: auto;
  justify-content: flex-end;
}

.main-window-session-button {
  min-height: 38px;
  padding-inline: 10px;
  color: #334155;
  font-weight: 700;
}

.main-window-plan-button {
  min-height: 38px;
  padding-inline: 4px;
  color: #64748b;
  font-weight: 700;
}

.main-window-nav-button {
  min-width: 136px;
  min-height: 42px;
  padding: 7px 14px 7px 10px;
  border-radius: 999px !important;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.04);
}

.main-window-shell :deep(.arco-btn) {
  font-weight: 600;
}

.main-window-nav-button :deep(.arco-btn-icon) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  margin-right: 2px;
  border-radius: 999px;
  background: rgba(100, 116, 139, 0.1);
  color: #475569;
}

.main-window-shell :deep(.arco-btn-secondary) {
  border-color: rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.84);
  color: #334155;
}

.main-window-shell :deep(.arco-btn-secondary:hover) {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.28);
  background: #ffffff;
  color: #132238;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.07);
}

.main-window-shell :deep(.arco-btn-primary) {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.72);
  background: linear-gradient(180deg, var(--theme-primary-color), var(--theme-primary-color-deep));
  color: var(--theme-primary-contrast, #ffffff);
  box-shadow: 0 10px 22px rgba(var(--theme-primary-rgb-8, 193, 141, 0), 0.18);
}

.main-window-shell :deep(.arco-btn-primary:hover) {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.82);
  background: linear-gradient(180deg, var(--theme-primary-color), var(--theme-primary-color-deep));
  color: var(--theme-primary-contrast, #ffffff);
}

.main-window-nav-button.arco-btn-primary :deep(.arco-btn-icon) {
  background: rgba(255, 255, 255, 0.2);
  color: var(--theme-primary-contrast, #ffffff);
}

.main-window-status-tag {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding-inline: 12px;
  font-weight: 700;
}

.main-window-top-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.main-window-icon-button {
  width: 34px;
  min-width: 34px;
  height: 34px;
  padding: 0;
  border-radius: 999px !important;
  color: var(--theme-primary-ink, #445468);
  background: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.08);
  border: 1px solid rgba(var(--theme-primary-rgb, 247, 181, 0), 0.14);
  box-shadow: none;
}

.main-window-icon-button :deep(.arco-btn-icon) {
  margin-right: 0;
}

.main-window-icon-button:hover {
  color: var(--theme-primary-ink, #445468);
  background: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.12);
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.18);
  box-shadow: 0 8px 18px rgba(var(--theme-primary-rgb-8, 193, 141, 0), 0.12);
}

.main-window-icon-button.is-danger {
  color: #be123c;
  background: rgba(244, 63, 94, 0.1);
  border-color: rgba(244, 63, 94, 0.14);
}

.main-window-icon-button.is-danger:hover {
  color: #9f1239;
  background: rgba(244, 63, 94, 0.16);
  border-color: rgba(244, 63, 94, 0.22);
}

.main-window-runtime-alert {
  border-radius: 18px;
}

body.light-frame-theme .main-window-shell-card {
  background: rgba(255, 255, 255, 0.98);
  border-color: rgba(148, 163, 184, 0.14);
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.05);
}

body.dark-theme .main-window-shell-card {
  background: rgba(10, 18, 31, 0.9);
  border-color: rgba(71, 85, 105, 0.28);
  box-shadow: 0 12px 24px rgba(2, 6, 23, 0.24);
}

body.dark-theme .main-window-shell-mark {
  color: #f9e6a5;
}

body.dark-theme .main-window-shell-overview-copy strong {
  color: #e5eefc;
}

body.dark-theme .main-window-shell-overview-copy span {
  color: #94a3b8;
}

body.dark-theme .main-window-shell-nav-strip {
  background: rgba(15, 23, 42, 0.92);
  border-color: rgba(71, 85, 105, 0.28);
}

body.dark-theme .main-window-session-button {
  color: #dbe7f5;
}

body.dark-theme .main-window-plan-button {
  color: #94a3b8;
}

body.dark-theme .main-window-icon-button {
  background: rgba(var(--theme-primary-rgb-10, 124, 92, 0), 0.22);
  border-color: rgba(var(--theme-primary-rgb-8, 193, 141, 0), 0.22);
  color: #f9e6a5;
}

body.dark-theme .main-window-shell :deep(.arco-btn-secondary) {
  border-color: rgba(71, 85, 105, 0.3);
  background: rgba(15, 23, 42, 0.92);
  color: #dbe7f5;
}

body.dark-theme .main-window-nav-button :deep(.arco-btn-icon) {
  background: rgba(148, 163, 184, 0.14);
  color: #dbe7f5;
}

body.dark-theme .main-window-shell :deep(.arco-btn-secondary:hover) {
  border-color: rgba(var(--theme-primary-rgb-8, 193, 141, 0), 0.3);
  background: rgba(30, 41, 59, 0.96);
  color: #f8fafc;
}

@media (max-width: 920px) {
  .main-window-shell-card {
    align-items: stretch;
  }

  .main-window-shell-overview,
  .main-window-shell-center,
  .main-window-shell-right {
    width: 100%;
  }

  .main-window-shell-right {
    margin-left: 0;
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .main-window-nav-button {
    min-width: 0;
    flex: 1 1 calc(50% - 10px);
    padding-inline: 10px;
  }
}
</style>
