<template>
  <div class="global-config-app-shell">
    <aside class="global-config-app-sidebar">
      <div class="global-config-app-sidebar-head">
        <div class="global-config-app-mark">
          <icon-settings />
        </div>
        <div class="global-config-app-title-group">
          <h2>&#x5168;&#x5c40;&#x914d;&#x7f6e;</h2>
          <p>{{ updatedAtLabel }}</p>
        </div>
      </div>

      <a-menu
        :selected-keys="[activeTab]"
        class="global-config-app-menu"
        @menu-item-click="handleTabChange"
      >
        <a-menu-item
          v-for="tab in tabs"
          :key="tab.key"
        >
          <template #icon>
            <icon-storage v-if="tab.icon === 'storage'" />
            <icon-robot v-else-if="tab.icon === 'robot'" />
            <icon-sync v-else-if="tab.icon === 'sync'" />
            <icon-settings v-else-if="tab.icon === 'settings'" />
            <icon-palette v-else />
          </template>
          {{ tab.title }}
        </a-menu-item>
      </a-menu>
    </aside>

    <section class="global-config-app-main">
      <div v-if="loading" class="global-config-app-loading">
        <a-spin size="large" />
      </div>

      <template v-else>
        <section v-show="activeTab === 'storage'" class="global-config-panel">
          <header class="global-config-panel-head">
            <div>
              <p class="global-config-panel-eyebrow">&#x5b58;&#x50a8;&#x7d20;&#x6750;</p>
              <h3>&#x5b58;&#x50a8;&#x7d20;&#x6750;</h3>
            </div>
            <div class="global-config-panel-actions">
              <a-tag
                v-if="storageStatus.message"
                :color="statusColorMap[storageStatus.type] || 'gray'"
                bordered
              >
                {{ storageStatus.message }}
              </a-tag>
              <a-button
                type="primary"
                :loading="savingStorage"
                @click="saveStorageConfig"
              >
                <template #icon>
                  <icon-save />
                </template>
                &#x4fdd;&#x5b58;&#x914d;&#x7f6e;
              </a-button>
            </div>
          </header>

          <a-alert class="global-config-panel-notice">
            <template #icon>
              <icon-info-circle />
            </template>
            <template #title>
              &#x5b58;&#x50a8;&#x4f5c;&#x7528;
            </template>
            &#x7528;&#x4e8e;&#x7edf;&#x4e00;&#x7ba1;&#x7406;&#x56fe;&#x7247;&#x3001;&#x89c6;&#x9891;&#x548c;&#x7d20;&#x6750;&#x6587;&#x4ef6;&#x7684;&#x5b58;&#x50a8;&#x4f4d;&#x7f6e;&#xff0c;&#x5e76;&#x6309;&#x5f53;&#x524d;&#x8f6f;&#x4ef6;&#x8d26;&#x53f7;&#x72ec;&#x7acb;&#x4fdd;&#x5b58;&#x3002;
          </a-alert>

          <a-radio-group
            v-model="storageConfig.activeProvider"
            type="button"
            size="large"
            class="global-config-provider-group"
          >
            <a-radio value="tencent-cos">
              <span class="global-config-provider-option">
                <icon-cloud />
                COS
              </span>
            </a-radio>
            <a-radio value="cloudflare-r2">
              <span class="global-config-provider-option">
                <icon-public />
                R2
              </span>
            </a-radio>
          </a-radio-group>

          <a-card
            v-if="storageConfig.activeProvider === 'tencent-cos'"
            class="global-config-card"
            :bordered="false"
          >
            <template #title>
              <div class="global-config-card-head">
                <div>
                  <h4>&#x817e;&#x8baf;&#x4e91; COS</h4>
                  <p>&#x9002;&#x5408;&#x56fd;&#x5185;&#x7d20;&#x6750;&#x5b58;&#x50a8;</p>
                </div>
                <a-switch v-model="storageConfig.providers.tencentCos.enabled" />
              </div>
            </template>

            <a-form layout="vertical" class="global-config-form-grid">
              <a-form-item label="SecretId">
                <a-input v-model="storageConfig.providers.tencentCos.secretId" allow-clear />
              </a-form-item>
              <a-form-item label="SecretKey">
                <a-input-password
                  v-model="storageConfig.providers.tencentCos.secretKey"
                  allow-clear
                />
              </a-form-item>
              <a-form-item label="&#x5b58;&#x50a8;&#x6876;" class="global-config-form-full-row">
                <div class="global-config-bucket-row">
                  <a-select
                    v-model="selectedTencentBucket"
                    :options="tencentBucketOptions"
                    style="width: 100%"
                    allow-clear
                    placeholder="&#x8bf7;&#x9009;&#x62e9;&#x5b58;&#x50a8;&#x6876;"
                    @change="handleTencentBucketChange"
                  />
                  <a-button
                    :loading="loadingBuckets"
                    size="small"
                    @click="loadTencentBuckets"
                  >
                    <template #icon>
                      <icon-refresh />
                    </template>
                    &#x83b7;&#x53d6;&#x5b58;&#x50a8;&#x6876;
                  </a-button>
                  <a-button
                    size="small"
                    @click="openCosBrowser('tencent-cos')"
                  >
                    <template #icon>
                      <icon-folder />
                    </template>
                    &#x6d4f;&#x89c8;&#x76ee;&#x5f55;
                  </a-button>
                </div>
              </a-form-item>

            </a-form>
          </a-card>

          <a-card
            v-else
            class="global-config-card"
            :bordered="false"
          >
            <template #title>
              <div class="global-config-card-head">
                <div>
                  <h4>Cloudflare R2</h4>
                  <p>&#x9002;&#x5408;&#x6d77;&#x5916;&#x7d20;&#x6750;&#x52a0;&#x901f;</p>
                </div>
                <a-switch v-model="storageConfig.providers.cloudflareR2.enabled" />
              </div>
            </template>

            <a-form layout="vertical" class="global-config-form-grid">
              <a-form-item label="Account ID">
                <a-input v-model="storageConfig.providers.cloudflareR2.accountId" allow-clear />
              </a-form-item>
              <a-form-item label="Access Key ID">
                <a-input v-model="storageConfig.providers.cloudflareR2.accessKeyId" allow-clear />
              </a-form-item>
              <a-form-item label="Secret Access Key">
                <a-input-password
                  v-model="storageConfig.providers.cloudflareR2.secretAccessKey"
                  allow-clear
                />
              </a-form-item>
              <a-form-item label="API Token">
                <a-input-password
                  v-model="storageConfig.providers.cloudflareR2.apiToken"
                  allow-clear
                />
              </a-form-item>
              <a-form-item label="&#x5b58;&#x50a8;&#x6876;" class="global-config-form-full-row">
                <div class="global-config-bucket-row">
                  <a-select
                    v-model="selectedCloudflareBucket"
                    :options="cloudflareBucketOptions"
                    style="width: 100%"
                    allow-clear
                    placeholder="&#x8bf7;&#x9009;&#x62e9;&#x5b58;&#x50a8;&#x6876;"
                    @change="handleCloudflareBucketChange"
                  />
                  <a-button
                    :loading="loadingCloudflareBuckets"
                    size="small"
                    @click="loadCloudflareBuckets"
                  >
                    <template #icon>
                      <icon-refresh />
                    </template>
                    &#x83b7;&#x53d6;&#x5b58;&#x50a8;&#x6876;
                  </a-button>
                  <a-button
                    size="small"
                    @click="openCloudflareBucketBrowser"
                  >
                    <template #icon>
                      <icon-folder />
                    </template>
                    &#x6d4f;&#x89c8;&#x76ee;&#x5f55;
                  </a-button>
                </div>
              </a-form-item>
              <a-form-item label="&#x516c;&#x5171;&#x57df;&#x540d;" class="global-config-form-full-row">
                <div class="global-config-bucket-row">
                  <a-select
                    v-model="selectedCloudflarePublicDomain"
                    :options="cloudflarePublicDomainOptions"
                    style="width: 100%"
                    allow-clear
                    placeholder="&#x8bf7;&#x9009;&#x62e9;&#x516c;&#x5171;&#x57df;&#x540d;"
                    @change="handleCloudflarePublicDomainChange"
                  />
                  <a-button
                    :loading="loadingCloudflarePublicDomains"
                    size="small"
                    @click="loadCloudflarePublicDomains"
                  >
                    <template #icon>
                      <icon-refresh />
                    </template>
                    &#x83b7;&#x53d6;&#x516c;&#x5171;&#x57df;&#x540d;
                  </a-button>
                </div>
              </a-form-item>
            </a-form>
          </a-card>
        </section>

        <section v-show="activeTab === 'ai'" class="global-config-panel">
          <header class="global-config-panel-head">
            <div>
              <p class="global-config-panel-eyebrow">AI &#x914d;&#x7f6e;</p>
              <h3>AI &#x914d;&#x7f6e;</h3>
            </div>
            <div class="global-config-panel-actions">
              <a-tag
                v-if="aiStatus.message"
                :color="statusColorMap[aiStatus.type] || 'gray'"
                bordered
              >
                {{ aiStatus.message }}
              </a-tag>
              <a-button
                type="primary"
                :loading="savingAi"
                @click="saveAiConfig"
              >
                <template #icon>
                  <icon-save />
                </template>
                &#x4fdd;&#x5b58;&#x914d;&#x7f6e;
              </a-button>
            </div>
          </header>

          <a-alert class="global-config-panel-notice">
            <template #icon>
              <icon-info-circle />
            </template>
            <template #title>
              AI &#x4f5c;&#x7528;
            </template>
            &#x7528;&#x4e8e; AI &#x8bc6;&#x56fe;&#x3001;&#x6279;&#x91cf;&#x751f;&#x6210;&#x6807;&#x9898;&#x548c;&#x540e;&#x7eed;&#x5185;&#x5bb9;&#x751f;&#x6210;&#x529f;&#x80fd;&#x3002;
          </a-alert>

          <a-card class="global-config-card" :bordered="false">
            <template #title>
              <div class="global-config-card-head">
                <div>
                  <h4>&#x706b;&#x5c71;&#x5f15;&#x64ce;</h4>
                  <p>&#x591a; APIKEY &#x8f6e;&#x8be2;&#x4f7f;&#x7528;</p>
                </div>
                <a-switch v-model="aiConfig.providers.volcengine.enabled" />
              </div>
            </template>

            <a-form layout="vertical" class="global-config-form-grid">
              <a-form-item label="API Base URL">
                <a-select
                  v-model="aiConfig.providers.volcengine.apiBaseUrl"
                  :options="aiBaseUrlOptions"
                />
              </a-form-item>
              <a-form-item label="&#x6a21;&#x578b;&#x540d;&#x79f0;">
                <a-select
                  v-model="aiConfig.providers.volcengine.model"
                  :options="aiModelOptions"
                />
              </a-form-item>
            </a-form>

            <div class="global-config-key-head">
              <div>
                <h5>APIKEY</h5>
                <p>&#x542f;&#x7528;&#x7684; APIKEY &#x4f1a;&#x6309;&#x987a;&#x5e8f;&#x8f6e;&#x8be2;&#x4f7f;&#x7528;&#x3002;</p>
              </div>
              <a-button @click="addAiKey">
                <template #icon>
                  <icon-plus />
                </template>
                &#x65b0;&#x589e; APIKEY
              </a-button>
            </div>

            <div v-if="aiConfig.providers.volcengine.apiKeys.length" class="global-config-key-list">
              <a-card
                v-for="(apiKey, index) in aiConfig.providers.volcengine.apiKeys"
                :key="apiKey.id"
                class="global-config-key-card"
                :bordered="false"
              >
                <div class="global-config-key-layout">
                  <div class="global-config-key-top">
                    <div class="global-config-key-identity">
                      <a-switch v-model="apiKey.enabled" />
                      <a-input
                        v-model="apiKey.name"
                        :placeholder="`APIKEY ${index + 1}`"
                        allow-clear
                      />
                    </div>
                    <a-space class="global-config-key-actions">
                      <a-button
                        :loading="testingKeyIds.has(apiKey.id)"
                        @click="testAiKey(apiKey.id)"
                      >
                        <template #icon>
                          <icon-check-circle />
                        </template>
                        &#x6d4b;&#x8bd5;
                      </a-button>
                      <a-button
                        status="danger"
                        @click="removeAiKey(apiKey.id)"
                      >
                        <template #icon>
                          <icon-delete />
                        </template>
                        &#x5220;&#x9664;
                      </a-button>
                    </a-space>
                  </div>

                  <div class="global-config-key-secret-row">
                    <a-input
                      v-model="apiKey.apiKey"
                      :type="visibleKeyIds.has(apiKey.id) ? 'text' : 'password'"
                      placeholder="&#x8bf7;&#x8f93;&#x5165; APIKEY"
                      allow-clear
                    >
                      <template #suffix>
                        <a-button
                          type="text"
                          class="global-config-inline-icon-button"
                          @click="toggleKeyVisibility(apiKey.id)"
                        >
                          <template #icon>
                            <icon-eye v-if="visibleKeyIds.has(apiKey.id)" />
                            <icon-eye-invisible v-else />
                          </template>
                        </a-button>
                      </template>
                    </a-input>
                  </div>

                  <div class="global-config-key-status-panel">
                    <div class="global-config-key-status">
                      <div class="global-config-key-status-row">
                        <a-tag :color="getKeyStatusColor(apiKey.lastTestStatus)" bordered>
                          {{ getKeyStatusText(apiKey.lastTestStatus) }}
                        </a-tag>
                        <span
                          v-if="getKeyTestedAtLabel(apiKey)"
                          class="global-config-key-tested-at"
                        >
                          {{ getKeyTestedAtLabel(apiKey) }}
                        </span>
                      </div>
                      <span
                        class="global-config-key-detail"
                        :class="`is-${apiKey.lastTestStatus || 'untested'}`"
                      >
                        {{ getKeyStatusDetail(apiKey) }}
                      </span>
                    </div>
                  </div>
                </div>
              </a-card>
            </div>

          <a-empty v-else description="&#x6682;&#x672a;&#x6dfb;&#x52a0; APIKEY" />
          </a-card>
        </section>

        <section v-show="activeTab === 'appearance'" class="global-config-panel">
          <header class="global-config-panel-head">
            <div>
              <p class="global-config-panel-eyebrow">&#x901a;&#x7528;&#x8bbe;&#x7f6e;</p>
              <h3>&#x901a;&#x7528;&#x8bbe;&#x7f6e;</h3>
            </div>
            <div class="global-config-panel-actions">
              <a-tag
                v-if="generalStatus.message"
                :color="statusColorMap[generalStatus.type] || 'gray'"
                bordered
              >
                {{ generalStatus.message }}
              </a-tag>
              <a-button
                type="primary"
                class="global-config-theme-save-button"
                :loading="savingGeneral"
                :style="generalSaveButtonStyle"
                @click="saveGeneralConfig"
              >
                <template #icon>
                  <icon-save />
                </template>
                &#x4fdd;&#x5b58;&#x8bbe;&#x7f6e;
              </a-button>
            </div>
          </header>

          <a-alert class="global-config-panel-notice">
            <template #icon>
              <icon-info-circle />
            </template>
            <template #title>
              &#x8bbe;&#x7f6e;&#x8bf4;&#x660e;
            </template>
            &#x914d;&#x7f6e;&#x754c;&#x9762;&#x4e3b;&#x9898;&#x3001;&#x4e3b;&#x9898;&#x914d;&#x8272;&#x548c;&#x7a97;&#x53e3;&#x884c;&#x4e3a;&#x504f;&#x597d;&#xff0c;&#x70b9;&#x51fb;&#x4fdd;&#x5b58;&#x540e;&#x7acb;&#x5373;&#x751f;&#x6548;&#x3002;
          </a-alert>

          <a-card class="global-config-card" :bordered="false">
            <template #title>
              <div class="global-config-card-head">
                <div>
                  <h4>&#x57fa;&#x7840;&#x504f;&#x597d;</h4>
                  <p>&#x53c2;&#x8003;&#x6613;&#x667a;&#x7535;&#x5546;&#x7684;&#x5168;&#x5c40;&#x8bbe;&#x7f6e;&#x7ed3;&#x6784;</p>
                </div>
              </div>
            </template>

            <div class="global-config-setting-section">
              <div class="global-config-setting-row">
                <div>
                  <strong>&#x8f6f;&#x4ef6;&#x4e3b;&#x9898;</strong>
                  <span>&#x63a7;&#x5236;&#x4e3b;&#x7a97;&#x53e3;&#x3001;&#x767b;&#x5f55;&#x9875;&#x548c;&#x540e;&#x7eed;&#x754c;&#x9762;&#x7684;&#x6d45;&#x6df1;&#x98ce;&#x683c;</span>
                </div>
                <a-select
                  v-model="generalConfig.theme"
                  :options="generalThemeOptions"
                  class="global-config-setting-control"
                  size="medium"
                />
              </div>

              <div class="global-config-setting-row">
                <div>
                  <strong>&#x4e3b;&#x9898;&#x914d;&#x8272;</strong>
                  <span>&#x7edf;&#x4e00;&#x5f71;&#x54cd;&#x6309;&#x94ae;&#x3001;&#x6807;&#x7b7e;&#x3001;&#x9ad8;&#x4eae;&#x4e0e;&#x72b6;&#x6001;&#x8272;</span>
                </div>
                <a-select
                  v-model="generalConfig.accentTheme"
                  :options="appearancePresetOptions"
                  class="global-config-setting-control"
                  size="medium"
                  @change="handleAccentThemeChange"
                >
                  <template #prefix>
                    <span
                      class="global-config-color-dot"
                      :style="{ background: activeAppearancePreset.value }"
                    />
                  </template>
                </a-select>
              </div>

              <div class="global-config-setting-row">
                <div>
                  <strong>&#x6253;&#x5f00;&#x65f6;&#x6062;&#x590d;&#x7a97;&#x53e3;</strong>
                  <span>&#x4e0b;&#x6b21;&#x542f;&#x52a8;&#x65f6;&#x4fdd;&#x6301;&#x4e0a;&#x6b21;&#x7684;&#x57fa;&#x672c;&#x7a97;&#x53e3;&#x72b6;&#x6001;</span>
                </div>
                <div class="global-config-setting-switch-wrap">
                  <a-switch v-model="generalConfig.restoreWindow" />
                </div>
              </div>

              <div class="global-config-setting-row">
                <div>
                  <strong>&#x914d;&#x7f6e;&#x81ea;&#x52a8;&#x540c;&#x6b65;</strong>
                  <span>&#x4e0d;&#x540c;&#x8f6f;&#x4ef6;&#x8d26;&#x53f7;&#x7684;&#x901a;&#x7528;&#x504f;&#x597d;&#x4f1a;&#x72ec;&#x7acb;&#x4fdd;&#x5b58;</span>
                </div>
                <div class="global-config-setting-switch-wrap">
                  <a-switch v-model="generalConfig.autoSync" />
                </div>
              </div>
            </div>
          </a-card>
        </section>

        <section v-show="activeTab === 'update'" class="global-config-panel">
          <header class="global-config-panel-head">
            <div>
              <p class="global-config-panel-eyebrow">&#x66f4;&#x65b0;&#x8bbe;&#x7f6e;</p>
              <h3>&#x66f4;&#x65b0;&#x8bbe;&#x7f6e;</h3>
            </div>
            <div class="global-config-panel-actions">
              <a-tag
                v-if="updateStatus.message"
                :color="statusColorMap[updateStatus.type] || 'gray'"
                bordered
              >
                {{ updateStatus.message }}
              </a-tag>
              <a-button
                type="primary"
                :loading="savingUpdate"
                @click="saveUpdateConfig"
              >
                <template #icon>
                  <icon-save />
                </template>
                &#x4fdd;&#x5b58;&#x8bbe;&#x7f6e;
              </a-button>
            </div>
          </header>

          <a-alert class="global-config-panel-notice">
            <template #icon>
              <icon-info-circle />
            </template>
            <template #title>
              &#x66f4;&#x65b0;&#x7b56;&#x7565;
            </template>
            &#x8bbe;&#x7f6e;&#x8f6f;&#x4ef6;&#x5347;&#x7ea7;&#x504f;&#x597d;&#xff0c;&#x5305;&#x62ec;&#x66f4;&#x65b0;&#x901a;&#x9053;&#x3001;&#x81ea;&#x52a8;&#x68c0;&#x67e5;&#x548c;&#x5dee;&#x5f02;&#x66f4;&#x65b0;&#x3002;&#x914d;&#x7f6e;&#x4fdd;&#x5b58;&#x540e;&#x5373;&#x751f;&#x6548;&#x3002;
          </a-alert>

          <a-card class="global-config-card" :bordered="false">
            <template #title>
              <div class="global-config-card-head">
                <div>
                  <h4>&#x66f4;&#x65b0;&#x504f;&#x597d;</h4>
                  <p>&#x53c2;&#x8003;&#x6613;&#x667a;&#x7535;&#x5546;&#x7684;&#x8bbe;&#x7f6e;&#x5206;&#x7ec4;</p>
                </div>
              </div>
            </template>

            <div class="global-config-setting-section">
              <div class="global-config-setting-row">
                <div>
                  <strong>&#x542f;&#x52a8;&#x65f6;&#x68c0;&#x67e5;&#x66f4;&#x65b0;</strong>
                  <span>&#x540e;&#x7eed;&#x68c0;&#x6d4b;&#x5230;&#x65b0;&#x7248;&#x672c;&#x65f6;&#x53ef;&#x4ee5;&#x76f4;&#x63a5;&#x63d0;&#x9192;</span>
                </div>
                <div class="global-config-setting-switch-wrap">
                  <a-switch v-model="updateConfig.autoCheck" />
                </div>
              </div>

              <div class="global-config-setting-row">
                <div>
                  <strong>&#x66f4;&#x65b0;&#x901a;&#x9053;</strong>
                  <span>&#x533a;&#x5206;&#x6b63;&#x5f0f;&#x7248;&#x548c;&#x6d4b;&#x8bd5;&#x7248;&#x7684;&#x6536;&#x5305;&#x7b56;&#x7565;</span>
                </div>
                <a-select
                  v-model="updateConfig.channel"
                  :options="updateChannelOptions"
                  class="global-config-setting-control"
                  size="medium"
                />
              </div>

              <div class="global-config-setting-row">
                <div>
                  <strong>&#x5dee;&#x5f02;&#x66f4;&#x65b0;</strong>
                  <span>&#x5c3d;&#x91cf;&#x53ea;&#x4e0b;&#x8f7d;&#x7248;&#x672c;&#x53d8;&#x66f4;&#x7684;&#x90e8;&#x5206;</span>
                </div>
                <div class="global-config-setting-switch-wrap">
                  <a-switch v-model="updateConfig.differential" />
                </div>
              </div>
            </div>
          </a-card>
        </section>
      </template>
    </section>

    <a-modal
      v-model:visible="tencentCosBrowserVisible"
      :title="'&#x6d4f;&#x89c8;&#x76ee;&#x5f55; - ' + cosBrowserBucketName"
      :width="760"
      :mask-closable="false"
      :footer="false"
      @close="closeCosBrowser"
    >
      <div class="cos-browser-toolbar">
        <div class="cos-browser-breadcrumb">
          <a-breadcrumb>
            <a-breadcrumb-item
              :key="'root'"
              class="cos-browser-breadcrumb-clickable"
              @click="navigateCosBrowserTo('')"
            >
              {{ storageConfig.providers.tencentCos.bucket }}
            </a-breadcrumb-item>
            <a-breadcrumb-item
              v-for="(part, index) in cosBrowserPathParts"
              :key="index"
              :class="index === cosBrowserPathParts.length - 1 ? '' : 'cos-browser-breadcrumb-clickable'"
              @click="index < cosBrowserPathParts.length - 1 && navigateCosBrowserTo(cosBrowserPathPrefix(part.prefix))"
            >
              {{ part.name }}
            </a-breadcrumb-item>
          </a-breadcrumb>
        </div>
        <a-space>
          <a-button
            v-if="!cosBrowserSelectAll"
            size="small"
            :disabled="!cosBrowserObjects.length"
            @click="cosBrowserSelectAll = true"
          >
            &#x5168;&#x9009;
          </a-button>
          <a-button
            v-else
            size="small"
            :disabled="!cosBrowserObjects.length"
            @click="cosBrowserSelectAll = false"
          >
            &#x53d6;&#x6d88;&#x5168;&#x9009;
          </a-button>
          <a-popconfirm
            content="&#x786e;&#x5b9a;&#x5220;&#x9664;&#x9009;&#x4e2d;&#x7684;&#x6587;&#x4ef6;&#x548c;&#x6587;&#x4ef6;&#x5939;&#xff1f;&#x6b64;&#x64cd;&#x4f5c;&#x4e0d;&#x53ef;&#x64a4;&#x9500;&#x3002;"
            @ok="executeCosBrowserDelete"
          >
            <a-button
              size="small"
              status="danger"
              :loading="cosBrowserDeleting"
              :disabled="!cosBrowserCheckedKeys.length"
            >
              <template #icon>
                <icon-delete />
              </template>
              &#x6279;&#x91cf;&#x5220;&#x9664; ({{ cosBrowserCheckedKeys.length }})
            </a-button>
          </a-popconfirm>
        </a-space>
      </div>

      <div class="cos-browser-path-label">
        {{ cosBrowserPrefix || '\uff08\u6839\u76ee\u5f55\uff09' }}
      </div>

      <div
        class="cos-browser-list"
        :class="{ 'cos-browser-loading-mask': cosBrowserLoading }"
      >
        <a-spin :loading="cosBrowserLoading" tip="&#x52a0;&#x8f7d;&#x4e2d;">
          <div v-if="!cosBrowserObjects.length && !cosBrowserLoading" class="cos-browser-empty">
            &#x5f53;&#x524d;&#x76ee;&#x5f55;&#x4e3a;&#x7a7a;
          </div>
          <a-checkbox-group
            v-else
            v-model="cosBrowserCheckedKeys"
            direction="vertical"
            class="cos-browser-checkbox-group"
          >
            <div
              v-for="item in cosBrowserObjects"
              :key="item.key || item.prefix"
              class="cos-browser-item"
            >
              <div
                class="cos-browser-item-main"
                :class="{
                  'cos-browser-item-folder': item.type === 'folder',
                  'cos-browser-item-selected': cosBrowserCheckedKeys.includes(item.key || item.prefix)
                }"
              >
                <div class="cos-browser-item-left">
                  <a-checkbox :value="item.key || item.prefix" />
                  <template v-if="item.type === 'folder'">
                    <span
                      class="cos-browser-item-icon"
                      @click="navigateCosBrowserTo(item.prefix)"
                    >&#x1f4c1;</span>
                    <span
                      class="cos-browser-item-name cos-browser-item-name-link"
                      @click="navigateCosBrowserTo(item.prefix)"
                    >{{ item.name }}</span>
                  </template>
                  <template v-else>
                    <span class="cos-browser-item-icon">&#x1f4c4;</span>
                    <span class="cos-browser-item-name">{{ item.name }}</span>
                  </template>
                </div>
                <div class="cos-browser-item-right">
                  <span class="cos-browser-item-size">{{ formatCosBrowserSize(item.size) }}</span>
                  <span class="cos-browser-item-date">{{ formatCosBrowserDate(item.lastModified) }}</span>
                </div>
              </div>
            </div>
          </a-checkbox-group>
        </a-spin>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import {
  Message
} from '@arco-design/web-vue';
import {
  IconCheckCircle,
  IconCloud,
  IconDelete,
  IconEye,
  IconEyeInvisible,
  IconFolder,
  IconInfoCircle,
  IconPalette,
  IconPlus,
  IconPublic,
  IconRefresh,
  IconRobot,
  IconSave,
  IconSettings,
  IconStorage,
  IconSync
} from '@arco-design/web-vue/es/icon';
import { getGlobalConfigBridge } from './bridge';
import { getThemeBridge } from './bridge';
import {
  APPEARANCE_PRESET_COLORS,
  APPEARANCE_PRESET_OPTIONS,
  AI_BASE_URL_OPTIONS,
  AI_MODEL_OPTIONS,
  DEFAULT_ROOT_PREFIX,
  GENERAL_THEME_OPTIONS,
  GLOBAL_CONFIG_TABS,
  UPDATE_CHANNEL_OPTIONS
} from './constants';
import {
  createClientId,
  formatUpdatedAt,
  getErrorMessage,
  normalizeHexColor,
  normalizeAiConfig,
  normalizeGeneralSettings,
  normalizeStorageConfig,
  normalizeThemeAppearance,
  normalizeUpdateSettings
} from './normalize';

const tabs = GLOBAL_CONFIG_TABS;
const appearancePresets = APPEARANCE_PRESET_COLORS;
const appearancePresetOptions = APPEARANCE_PRESET_OPTIONS;
const activeTab = ref('appearance');
const loading = ref(true);
const savingGeneral = ref(false);
const savingStorage = ref(false);
const savingAi = ref(false);
const savingUpdate = ref(false);
const loadingBuckets = ref(false);
const loadingCloudflareBuckets = ref(false);
const loadingCloudflarePublicDomains = ref(false);
const tencentBuckets = ref([]);
const cloudflareBuckets = ref([]);
const cloudflarePublicDomains = ref([]);
const visibleKeyIds = reactive(new Set());
const testingKeyIds = reactive(new Set());
const generalStatus = reactive({
  type: 'default',
  message: ''
});
const storageStatus = reactive({
  type: 'default',
  message: ''
});
const aiStatus = reactive({
  type: 'default',
  message: ''
});
const updateStatus = reactive({
  type: 'default',
  message: ''
});

const generalConfig = reactive(normalizeGeneralSettings(null));
const storageConfig = reactive(normalizeStorageConfig(null));
const aiConfig = reactive(normalizeAiConfig(null));
const appearanceConfig = reactive(normalizeThemeAppearance(null));
const updateConfig = reactive(normalizeUpdateSettings(null));
const selectedTencentBucket = ref('');
const selectedCloudflareBucket = ref('');
const selectedCloudflarePublicDomain = ref('');

const tencentCosBrowserVisible = ref(false);
const cosBrowserLoading = ref(false);
const cosBrowserDeleting = ref(false);
const cosBrowserPrefix = ref('');
const cosBrowserObjects = ref([]);
const cosBrowserCheckedKeys = ref([]);
const cosBrowserSelectAll = ref(false);
const cosBrowserProvider = ref('tencent-cos');

const cosBrowserBucketName = computed(() => {
  if (cosBrowserProvider.value === 'cloudflare-r2') {
    return storageConfig.providers.cloudflareR2.bucket || '\u5b58\u50a8\u6876';
  }

  return storageConfig.providers.tencentCos.bucket || '\u5b58\u50a8\u6876';
});

const statusColorMap = Object.freeze({
  default: 'gray',
  success: 'green',
  error: 'red'
});

const aiBaseUrlOptions = AI_BASE_URL_OPTIONS.map((item) => ({
  value: item.value,
  label: item.label
}));

const aiModelOptions = AI_MODEL_OPTIONS.map((item) => ({
  value: item.value,
  label: item.label
}));

const generalThemeOptions = GENERAL_THEME_OPTIONS.map((item) => ({
  value: item.value,
  label: item.label
}));

const updateChannelOptions = UPDATE_CHANNEL_OPTIONS.map((item) => ({
  value: item.value,
  label: item.label
}));

const updatedAtLabel = computed(() => (
  activeTab.value === 'appearance'
    ? formatUpdatedAt(generalConfig.updatedAt || appearanceConfig.updatedAt)
    : activeTab.value === 'update'
    ? formatUpdatedAt(updateConfig.updatedAt)
    : activeTab.value === 'ai'
    ? formatUpdatedAt(aiConfig.updatedAt)
    : formatUpdatedAt(storageConfig.updatedAt)
));

const currentAppearancePresetLabel = computed(() => {
  return activeAppearancePreset.value ? activeAppearancePreset.value.label : '';
});

const activeAppearancePreset = computed(() => (
  getAppearancePresetByKey(generalConfig.accentTheme) || appearancePresets[0]
));

const generalSaveButtonStyle = computed(() => {
  const baseColor = normalizeHexColor(activeAppearancePreset.value && activeAppearancePreset.value.value);
  const deepColor = mixHexColor(baseColor, '#000000', 0.16);
  const shadowColor = hexToRgbText(mixHexColor(baseColor, '#000000', 0.34));

  return {
    background: `linear-gradient(135deg, ${baseColor}, ${deepColor})`,
    borderColor: deepColor,
    color: getReadableTextColor(baseColor),
    boxShadow: `0 12px 22px rgba(${shadowColor}, 0.22)`
  };
});

const tencentBucketOptions = computed(() => (
  tencentBuckets.value.map((bucket) => ({
    value: bucket.name,
    label: `${bucket.name} (${bucket.region})`
  }))
));

const cloudflareBucketOptions = computed(() => (
  cloudflareBuckets.value.map((bucket) => ({
    value: bucket.name,
    label: bucket.name
  }))
));

const cloudflarePublicDomainOptions = computed(() => cloudflarePublicDomains.value);

watch(cosBrowserSelectAll, (checked) => {
  if (checked) {
    cosBrowserCheckedKeys.value = cosBrowserObjects.value.map((item) => item.key || item.prefix);
  } else {
    cosBrowserCheckedKeys.value = [];
  }
});

watch(cosBrowserCheckedKeys, (keys) => {
  const total = cosBrowserObjects.value.map((item) => item.key || item.prefix).sort().join(',');
  const selected = [...keys].sort().join(',');

  cosBrowserSelectAll.value = total.length > 0 && selected === total;
});

const cosBrowserPathParts = computed(() => {
  const prefix = cosBrowserPrefix.value;

  if (!prefix) {
    return [];
  }

  const parts = prefix.replace(/\/$/, '').split('/');

  return parts.map((name, index) => ({
    name,
    prefix: `${parts.slice(0, index + 1).join('/')}/`
  }));
});

function cosBrowserPathPrefix(targetPrefix) {
  return targetPrefix;
}

function navigateCosBrowserTo(targetPrefix) {
  cosBrowserPrefix.value = typeof targetPrefix === 'string' ? targetPrefix : '';
  cosBrowserCheckedKeys.value = [];
  cosBrowserSelectAll.value = false;
  void loadCosBrowserObjects();
}

function openCosBrowser(provider) {
  cosBrowserProvider.value = provider === 'cloudflare-r2' ? 'cloudflare-r2' : 'tencent-cos';

  if (provider === 'cloudflare-r2') {
    const r2 = storageConfig.providers.cloudflareR2;

    if (!r2.accessKeyId || !r2.secretAccessKey) {
      setStorageStatus('\u8bf7\u5148\u586b\u5199 Access Key ID \u548c Secret Access Key\u3002', 'error');
      return;
    }

    if (!r2.accountId) {
      setStorageStatus('\u8bf7\u5148\u586b\u5199 Account ID\u3002', 'error');
      return;
    }

    if (!r2.bucket) {
      setStorageStatus('\u8bf7\u5148\u9009\u62e9\u5b58\u50a8\u6876\u3002', 'error');
      return;
    }
  } else {
    const tencent = storageConfig.providers.tencentCos;

    if (!tencent.secretId || !tencent.secretKey) {
      setStorageStatus('\u8bf7\u5148\u586b\u5199 SecretId \u548c SecretKey\u3002', 'error');
      return;
    }

    if (!tencent.bucket || !tencent.region) {
      setStorageStatus('\u8bf7\u5148\u9009\u62e9\u5b58\u50a8\u6876\u3002', 'error');
      return;
    }
  }

  cosBrowserPrefix.value = '';
  cosBrowserObjects.value = [];
  cosBrowserCheckedKeys.value = [];
  cosBrowserSelectAll.value = false;
  tencentCosBrowserVisible.value = true;
  void loadCosBrowserObjects();
}

function closeCosBrowser() {
  cosBrowserLoading.value = false;
  cosBrowserDeleting.value = false;
  cosBrowserPrefix.value = '';
  cosBrowserObjects.value = [];
  cosBrowserCheckedKeys.value = [];
  cosBrowserSelectAll.value = false;
  cosBrowserProvider.value = 'tencent-cos';
}

function formatCosBrowserSize(bytes) {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) {
    return '-';
  }

  if (bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

function formatCosBrowserDate(dateStr) {
  if (!dateStr) {
    return '-';
  }

  try {
    const d = new Date(dateStr);
    const pad = (n) => String(n).padStart(2, '0');

    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch (_error) {
    return dateStr.substring(0, 16);
  }
}

async function loadCosBrowserObjects() {
  cosBrowserLoading.value = true;
  cosBrowserCheckedKeys.value = [];

  try {
    let result;

    if (cosBrowserProvider.value === 'cloudflare-r2') {
      const r2 = storageConfig.providers.cloudflareR2;

      result = await getGlobalConfigBridge().listCloudflareR2Objects({
        accountId: r2.accountId,
        accessKeyId: r2.accessKeyId,
        secretAccessKey: r2.secretAccessKey,
        bucket: r2.bucket,
        prefix: cosBrowserPrefix.value
      });
    } else {
      const tencent = storageConfig.providers.tencentCos;

      result = await getGlobalConfigBridge().listTencentCosObjects({
        secretId: tencent.secretId,
        secretKey: tencent.secretKey,
        region: tencent.region,
        bucket: tencent.bucket,
        prefix: cosBrowserPrefix.value
      });
    }

    cosBrowserObjects.value = Array.isArray(result && result.objects) ? result.objects : [];
    cosBrowserSelectAll.value = false;
  } catch (error) {
    cosBrowserObjects.value = [];
    Message.error(getErrorMessage(error, '\u52a0\u8f7d\u76ee\u5f55\u5931\u8d25\u3002'));
  } finally {
    cosBrowserLoading.value = false;
  }
}

async function executeCosBrowserDelete() {
  if (!cosBrowserCheckedKeys.value.length) {
    return;
  }

  cosBrowserDeleting.value = true;

  try {
    let result;

    if (cosBrowserProvider.value === 'cloudflare-r2') {
      const r2 = storageConfig.providers.cloudflareR2;

      result = await getGlobalConfigBridge().deleteCloudflareR2Objects({
        accountId: r2.accountId,
        accessKeyId: r2.accessKeyId,
        secretAccessKey: r2.secretAccessKey,
        bucket: r2.bucket,
        objects: cosBrowserCheckedKeys.value.map((key) => ({ key }))
      });
    } else {
      const tencent = storageConfig.providers.tencentCos;

      result = await getGlobalConfigBridge().deleteTencentCosObjects({
        secretId: tencent.secretId,
        secretKey: tencent.secretKey,
        region: tencent.region,
        bucket: tencent.bucket,
        objects: cosBrowserCheckedKeys.value.map((key) => ({ key }))
      });
    }

    const deleted = (result && result.deletedCount) || 0;
    const errors = (result && result.errorCount) || 0;

    if (errors) {
      Message.warning(`\u5220\u9664\u5b8c\u6210\uff1a\u6210\u529f ${deleted} \u4e2a\uff0c\u5931\u8d25 ${errors} \u4e2a\u3002`);
    } else {
      Message.success(`\u5df2\u6279\u91cf\u5220\u9664 ${deleted} \u4e2a\u5bf9\u8c61\u3002`);
    }

    cosBrowserCheckedKeys.value = [];
    cosBrowserSelectAll.value = false;
    void loadCosBrowserObjects();
  } catch (error) {
    Message.error(getErrorMessage(error, '\u6279\u91cf\u5220\u9664\u5931\u8d25\u3002'));
  } finally {
    cosBrowserDeleting.value = false;
  }
}

function applyStorageConfig(nextConfig) {
  const normalized = normalizeStorageConfig(nextConfig);

  Object.assign(storageConfig, normalized);
  selectedTencentBucket.value = normalized.providers.tencentCos.bucket || '';
  selectedCloudflareBucket.value = normalized.providers.cloudflareR2.bucket || '';
  selectedCloudflarePublicDomain.value = normalized.providers.cloudflareR2.publicBaseUrl || '';
}

function applyGeneralConfig(nextConfig) {
  const normalized = normalizeGeneralSettings(nextConfig);

  Object.assign(generalConfig, normalized);
}

function applyAiConfig(nextConfig) {
  const normalized = normalizeAiConfig(nextConfig);

  Object.assign(aiConfig, normalized);
}

function applyAppearanceConfig(nextConfig) {
  const normalized = normalizeThemeAppearance(
    nextConfig && nextConfig.appearance ? nextConfig.appearance : nextConfig
  );

  Object.assign(appearanceConfig, normalized);
  syncAccentThemeFromPrimaryColor();
}

function applyUpdateConfig(nextConfig) {
  const normalized = normalizeUpdateSettings(nextConfig);

  Object.assign(updateConfig, normalized);
}

function syncAccentThemeFromPrimaryColor() {
  const normalizedColor = normalizeHexColor(appearanceConfig.primaryColor);
  const matchedPreset = appearancePresets.find((item) => item.value === normalizedColor);

  if (matchedPreset) {
    generalConfig.accentTheme = matchedPreset.key;
    appearanceConfig.primaryColor = matchedPreset.value;
    return;
  }

  const fallbackPreset = getAppearancePresetByKey(generalConfig.accentTheme) || appearancePresets[0];

  if (!fallbackPreset) {
    return;
  }

  generalConfig.accentTheme = fallbackPreset.key;
  appearanceConfig.primaryColor = fallbackPreset.value;
}

function getAppearancePresetByKey(presetKey) {
  return appearancePresets.find((item) => item.key === presetKey) || null;
}

function parseHexColor(value) {
  const normalized = normalizeHexColor(value);

  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16)
  };
}

function clampColorChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function mixHexColor(fromColor, toColor, weight) {
  const ratio = Math.max(0, Math.min(1, Number(weight) || 0));
  const from = parseHexColor(fromColor);
  const to = parseHexColor(toColor);

  return `#${[from.r, from.g, from.b]
    .map((channel, index) => {
      const target = index === 0 ? to.r : index === 1 ? to.g : to.b;
      return clampColorChannel(channel + (target - channel) * ratio)
        .toString(16)
        .padStart(2, '0');
    })
    .join('')}`;
}

function hexToRgbText(value) {
  const color = parseHexColor(value);

  return `${color.r}, ${color.g}, ${color.b}`;
}

function getReadableTextColor(value) {
  const color = parseHexColor(value);
  const channels = [color.r, color.g, color.b].map((channel) => {
    const srgb = channel / 255;

    return srgb <= 0.03928
      ? srgb / 12.92
      : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  const luminance = (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);

  return luminance > 0.52 ? '#172033' : '#ffffff';
}

function setThemeStatusMessage(message, type = 'default') {
  generalStatus.message = message || '';
  generalStatus.type = type;
}

function setStorageStatus(message, type = 'default') {
  storageStatus.message = message || '';
  storageStatus.type = type;
}

function setAiStatus(message, type = 'default') {
  aiStatus.message = message || '';
  aiStatus.type = type;
}

function setUpdateStatus(message, type = 'default') {
  updateStatus.message = message || '';
  updateStatus.type = type;
}

function handleTabChange(key) {
  if (key === 'ai' || key === 'appearance' || key === 'update') {
    activeTab.value = key;
    return;
  }

  activeTab.value = 'storage';
}

function handleTencentBucketChange(value) {
  selectedTencentBucket.value = typeof value === 'string' ? value : '';
  const matched = tencentBuckets.value.find((bucket) => bucket.name === selectedTencentBucket.value);

  if (!matched) {
    return;
  }

  storageConfig.providers.tencentCos.bucket = matched.name;
  storageConfig.providers.tencentCos.region = matched.region || '';
}

function buildStorageSavePayload() {
  return {
    activeProvider: storageConfig.activeProvider,
    providers: {
      tencentCos: {
        enabled: storageConfig.providers.tencentCos.enabled === true,
        secretId: String(storageConfig.providers.tencentCos.secretId || ''),
        secretKey: String(storageConfig.providers.tencentCos.secretKey || ''),
        bucket: String(storageConfig.providers.tencentCos.bucket || ''),
        region: String(storageConfig.providers.tencentCos.region || ''),
        rootPrefix: String(storageConfig.providers.tencentCos.rootPrefix || ''),
        protocol: String(storageConfig.providers.tencentCos.protocol || 'https:')
      },
      cloudflareR2: {
        enabled: storageConfig.providers.cloudflareR2.enabled === true,
        accountId: String(storageConfig.providers.cloudflareR2.accountId || ''),
        accessKeyId: String(storageConfig.providers.cloudflareR2.accessKeyId || ''),
        secretAccessKey: String(storageConfig.providers.cloudflareR2.secretAccessKey || ''),
        apiToken: String(storageConfig.providers.cloudflareR2.apiToken || ''),
        bucket: String(storageConfig.providers.cloudflareR2.bucket || ''),
        endpoint: String(storageConfig.providers.cloudflareR2.endpoint || ''),
        publicBaseUrl: String(storageConfig.providers.cloudflareR2.publicBaseUrl || ''),
        rootPrefix: String(storageConfig.providers.cloudflareR2.rootPrefix || '')
      }
    }
  };
}

function buildAiSavePayload() {
  return {
    activeProvider: aiConfig.activeProvider,
    providers: {
      volcengine: {
        enabled: aiConfig.providers.volcengine.enabled === true,
        apiBaseUrl: String(aiConfig.providers.volcengine.apiBaseUrl || ''),
        model: String(aiConfig.providers.volcengine.model || ''),
        apiKeys: Array.isArray(aiConfig.providers.volcengine.apiKeys)
          ? aiConfig.providers.volcengine.apiKeys.map((item, index) => ({
            id: String((item && item.id) || ''),
            name: String((item && item.name) || `APIKEY ${index + 1}`),
            apiKey: String((item && item.apiKey) || ''),
            enabled: !(item && item.enabled === false),
            lastTestedAt: String((item && item.lastTestedAt) || ''),
            lastTestStatus:
              item && (item.lastTestStatus === 'success' || item.lastTestStatus === 'error')
                ? item.lastTestStatus
                : 'untested',
            lastTestMessage: String((item && item.lastTestMessage) || '')
          }))
          : []
      }
    }
  };
}

function buildGeneralSavePayload() {
  return {
    theme: generalConfig.theme,
    accentTheme: generalConfig.accentTheme,
    restoreWindow: generalConfig.restoreWindow === true,
    autoSync: generalConfig.autoSync === true
  };
}

function buildUpdateSavePayload() {
  return {
    autoCheck: updateConfig.autoCheck === true,
    channel: String(updateConfig.channel || 'latest'),
    differential: updateConfig.differential === true
  };
}

async function loadAll() {
  loading.value = true;

  try {
    setThemeStatusMessage('\u6b63\u5728\u8bfb\u53d6');
    setStorageStatus('\u6b63\u5728\u8bfb\u53d6');
    setAiStatus('\u6b63\u5728\u8bfb\u53d6');
    setUpdateStatus('\u6b63\u5728\u8bfb\u53d6');

    const bridge = getGlobalConfigBridge();
    const themeBridge = getThemeBridge();

    const [generalSettled, storageSettled, aiSettled, updateSettled, themeSettled, appearanceSettled] =
      await Promise.allSettled([
        bridge.getGeneralSettings(),
        bridge.getStorageSelection(),
        bridge.getAiConfig(),
        bridge.getUpdateSettings(),
        themeBridge.getTheme(),
        themeBridge.getThemeAppearance()
      ]);

    const generalResult = generalSettled.status === 'fulfilled' ? generalSettled.value : null;
    const storageResult = storageSettled.status === 'fulfilled' ? storageSettled.value : null;
    const aiResult = aiSettled.status === 'fulfilled' ? aiSettled.value : null;
    const updateResult = updateSettled.status === 'fulfilled' ? updateSettled.value : null;
    const themeResult = themeSettled.status === 'fulfilled' ? themeSettled.value : null;
    const appearanceResult = appearanceSettled.status === 'fulfilled' ? appearanceSettled.value : null;

    if (generalResult !== null) {
      applyGeneralConfig({
        ...generalResult,
        theme: themeResult !== null ? themeResult : generalResult.theme
      });
    }

    if (storageResult !== null) {
      applyStorageConfig(storageResult);
      setStorageStatus(formatUpdatedAt(storageConfig.updatedAt));
    } else {
      setStorageStatus('\u5b58\u50a8\u914d\u7f6e\u8bfb\u53d6\u5931\u8d25', 'error');
    }

    if (aiResult !== null) {
      applyAiConfig(aiResult);
      setAiStatus(formatUpdatedAt(aiConfig.updatedAt));
    } else {
      setAiStatus('AI \u914d\u7f6e\u8bfb\u53d6\u5931\u8d25', 'error');
    }

    if (updateResult !== null) {
      applyUpdateConfig(updateResult);
      setUpdateStatus(formatUpdatedAt(updateConfig.updatedAt));
    } else {
      setUpdateStatus('\u66f4\u65b0\u8bbe\u7f6e\u8bfb\u53d6\u5931\u8d25', 'error');
    }

    if (appearanceResult !== null) {
      applyAppearanceConfig(appearanceResult);
    }

    if (generalResult !== null) {
      setThemeStatusMessage(formatUpdatedAt(generalConfig.updatedAt || (appearanceResult !== null ? appearanceResult.updatedAt : appearanceConfig.updatedAt)));
    } else {
      setThemeStatusMessage('\u901a\u7528\u8bbe\u7f6e\u8bfb\u53d6\u5931\u8d25', 'error');
    }
  } finally {
    loading.value = false;
  }
}

async function saveStorageConfig() {
  if (savingStorage.value) {
    return;
  }

  savingStorage.value = true;
  setStorageStatus('\u6b63\u5728\u4fdd\u5b58');

  try {
    const result = await getGlobalConfigBridge().saveStorageSelection(buildStorageSavePayload());

    applyStorageConfig(result);
    setStorageStatus(
      result && result.cloudSynced === false
        ? '\u5df2\u4fdd\u5b58\u5230\u672c\u5730\uff0c\u4e91\u7aef\u540c\u6b65\u672a\u5b8c\u6210'
        : '\u5b58\u50a8\u914d\u7f6e\u5df2\u4fdd\u5b58',
      result && result.cloudSynced === false ? 'default' : 'success'
    );
    Message.success('\u5b58\u50a8\u914d\u7f6e\u5df2\u66f4\u65b0');
  } catch (error) {
    setStorageStatus(getErrorMessage(error, '\u5b58\u50a8\u914d\u7f6e\u4fdd\u5b58\u5931\u8d25\u3002'), 'error');
  } finally {
    savingStorage.value = false;
  }
}

function handleCloudflareBucketChange(value) {
  selectedCloudflareBucket.value = typeof value === 'string' ? value : '';
  storageConfig.providers.cloudflareR2.bucket = selectedCloudflareBucket.value;
  selectedCloudflarePublicDomain.value = '';
  cloudflarePublicDomains.value = [];
}

function handleCloudflarePublicDomainChange(value) {
  selectedCloudflarePublicDomain.value = typeof value === 'string' ? value : '';
  storageConfig.providers.cloudflareR2.publicBaseUrl = selectedCloudflarePublicDomain.value;
}

async function loadCloudflareBuckets() {
  const r2 = storageConfig.providers.cloudflareR2;

  if (!r2.accountId || !r2.apiToken) {
    setStorageStatus('\u8bf7\u5148\u586b\u5199 Account ID \u548c API Token\u3002', 'error');
    return;
  }

  loadingCloudflareBuckets.value = true;
  setStorageStatus('\u6b63\u5728\u83b7\u53d6 Cloudflare R2 \u5b58\u50a8\u6876');

  try {
    const result = await getGlobalConfigBridge().listCloudflareR2Buckets({
      accountId: r2.accountId,
      apiToken: r2.apiToken
    });

    cloudflareBuckets.value = Array.isArray(result && result.buckets) ? result.buckets : [];
    selectedCloudflareBucket.value = cloudflareBuckets.value.some((bucket) => bucket.name === r2.bucket)
      ? r2.bucket
      : '';
    setStorageStatus(
      cloudflareBuckets.value.length
        ? `\u5df2\u83b7\u53d6 ${cloudflareBuckets.value.length} \u4e2a Cloudflare R2 \u5b58\u50a8\u6876\u3002`
        : '\u672a\u83b7\u53d6\u5230 Cloudflare R2 \u5b58\u50a8\u6876\u3002',
      cloudflareBuckets.value.length ? 'success' : 'default'
    );
  } catch (error) {
    cloudflareBuckets.value = [];
    selectedCloudflareBucket.value = '';
    setStorageStatus(getErrorMessage(error, '\u83b7\u53d6 Cloudflare R2 \u5b58\u50a8\u6876\u5931\u8d25\u3002'), 'error');
  } finally {
    loadingCloudflareBuckets.value = false;
  }
}

async function loadCloudflarePublicDomains() {
  const r2 = storageConfig.providers.cloudflareR2;

  if (!r2.accountId || !r2.apiToken) {
    setStorageStatus('\u8bf7\u5148\u586b\u5199 Account ID \u548c API Token\u3002', 'error');
    return;
  }

  if (!r2.bucket) {
    setStorageStatus('\u8bf7\u5148\u9009\u62e9\u5b58\u50a8\u6876\u3002', 'error');
    return;
  }

  loadingCloudflarePublicDomains.value = true;
  setStorageStatus('\u6b63\u5728\u83b7\u53d6\u516c\u5171\u57df\u540d');

  try {
    const result = await getGlobalConfigBridge().listCloudflareR2PublicDomains({
      accountId: r2.accountId,
      apiToken: r2.apiToken,
      bucket: r2.bucket
    });

    cloudflarePublicDomains.value = Array.isArray(result && result.domains) ? result.domains : [];
    selectedCloudflarePublicDomain.value = cloudflarePublicDomains.value.some((domain) => domain.value === r2.publicBaseUrl)
      ? r2.publicBaseUrl
      : '';
    setStorageStatus(
      cloudflarePublicDomains.value.length
        ? `\u5df2\u83b7\u53d6 ${cloudflarePublicDomains.value.length} \u4e2a\u516c\u5171\u57df\u540d\u3002`
        : '\u672a\u83b7\u53d6\u5230\u516c\u5171\u57df\u540d\u3002',
      cloudflarePublicDomains.value.length ? 'success' : 'default'
    );
  } catch (error) {
    cloudflarePublicDomains.value = [];
    selectedCloudflarePublicDomain.value = '';
    setStorageStatus(getErrorMessage(error, '\u83b7\u53d6\u516c\u5171\u57df\u540d\u5931\u8d25\u3002'), 'error');
  } finally {
    loadingCloudflarePublicDomains.value = false;
  }
}

function openCloudflareBucketBrowser() {
  openCosBrowser('cloudflare-r2');
}

async function loadTencentBuckets() {
  const tencent = storageConfig.providers.tencentCos;

  if (!tencent.secretId || !tencent.secretKey) {
    setStorageStatus('\u8bf7\u5148\u586b\u5199 SecretId \u548c SecretKey\u3002', 'error');
    return;
  }

  loadingBuckets.value = true;
  setStorageStatus('\u6b63\u5728\u83b7\u53d6\u5b58\u50a8\u6876');

  try {
    const result = await getGlobalConfigBridge().listTencentCosBuckets({
      secretId: tencent.secretId,
      secretKey: tencent.secretKey
    });

    tencentBuckets.value = Array.isArray(result && result.buckets) ? result.buckets : [];
    selectedTencentBucket.value = tencentBuckets.value.some((bucket) => bucket.name === tencent.bucket)
      ? tencent.bucket
      : '';
    setStorageStatus(
      tencentBuckets.value.length
        ? `\u5df2\u83b7\u53d6 ${tencentBuckets.value.length} \u4e2a\u5b58\u50a8\u6876\u3002`
        : '\u672a\u83b7\u53d6\u5230\u5b58\u50a8\u6876\u3002',
      tencentBuckets.value.length ? 'success' : 'default'
    );
  } catch (error) {
    tencentBuckets.value = [];
    selectedTencentBucket.value = '';
    setStorageStatus(getErrorMessage(error, '\u83b7\u53d6\u5b58\u50a8\u6876\u5931\u8d25\u3002'), 'error');
  } finally {
    loadingBuckets.value = false;
  }
}

async function saveAiConfig() {
  if (savingAi.value) {
    return;
  }

  savingAi.value = true;
  setAiStatus('\u6b63\u5728\u4fdd\u5b58');

  try {
    const result = await getGlobalConfigBridge().saveAiConfig(buildAiSavePayload());

    applyAiConfig(result);
    setAiStatus(
      result && result.cloudSynced === false
        ? '\u5df2\u4fdd\u5b58\u5230\u672c\u5730\uff0c\u4e91\u7aef\u540c\u6b65\u672a\u5b8c\u6210'
        : 'AI \u914d\u7f6e\u5df2\u4fdd\u5b58',
      result && result.cloudSynced === false ? 'default' : 'success'
    );
    Message.success('AI \u914d\u7f6e\u5df2\u66f4\u65b0');
  } catch (error) {
    setAiStatus(getErrorMessage(error, 'AI \u914d\u7f6e\u4fdd\u5b58\u5931\u8d25\u3002'), 'error');
  } finally {
    savingAi.value = false;
  }
}

async function saveGeneralConfig() {
  if (savingGeneral.value) {
    return;
  }

  savingGeneral.value = true;
  setThemeStatusMessage('\u6b63\u5728\u4fdd\u5b58');

  try {
    const bridge = getGlobalConfigBridge();
    const themeBridge = getThemeBridge();
    const generalResult = await bridge.saveGeneralSettings(buildGeneralSavePayload());

    await themeBridge.setTheme({
      theme: generalConfig.theme
    });
    const appearanceResult = await themeBridge.setThemeAppearance({
      primaryColor: normalizeHexColor(appearanceConfig.primaryColor)
    });

    applyGeneralConfig(generalResult);
    applyAppearanceConfig(appearanceResult && appearanceResult.appearance ? appearanceResult.appearance : appearanceResult);
    setThemeStatusMessage(
      generalResult && generalResult.cloudSynced === false
        ? '\u5df2\u4fdd\u5b58\u5230\u672c\u5730\uff0c\u4e91\u7aef\u540c\u6b65\u672a\u5b8c\u6210'
        : '\u901a\u7528\u8bbe\u7f6e\u5df2\u4fdd\u5b58',
      generalResult && generalResult.cloudSynced === false ? 'default' : 'success'
    );
    Message.success('\u901a\u7528\u8bbe\u7f6e\u5df2\u66f4\u65b0');
  } catch (error) {
    const message = getErrorMessage(error, '\u901a\u7528\u8bbe\u7f6e\u4fdd\u5b58\u5931\u8d25\u3002');
    setThemeStatusMessage(message, 'error');
  } finally {
    savingGeneral.value = false;
  }
}

async function saveUpdateConfig() {
  if (savingUpdate.value) {
    return;
  }

  savingUpdate.value = true;
  setUpdateStatus('\u6b63\u5728\u4fdd\u5b58');

  try {
    const result = await getGlobalConfigBridge().saveUpdateSettings(buildUpdateSavePayload());

    applyUpdateConfig(result);
    setUpdateStatus(
      result && result.cloudSynced === false
        ? '\u5df2\u4fdd\u5b58\u5230\u672c\u5730\uff0c\u4e91\u7aef\u540c\u6b65\u672a\u5b8c\u6210'
        : '\u66f4\u65b0\u8bbe\u7f6e\u5df2\u4fdd\u5b58',
      result && result.cloudSynced === false ? 'default' : 'success'
    );
    Message.success('\u66f4\u65b0\u8bbe\u7f6e\u5df2\u66f4\u65b0');
  } catch (error) {
    setUpdateStatus(getErrorMessage(error, '\u66f4\u65b0\u8bbe\u7f6e\u4fdd\u5b58\u5931\u8d25\u3002'), 'error');
  } finally {
    savingUpdate.value = false;
  }
}

function addAiKey() {
  aiConfig.providers.volcengine.apiKeys.push({
    id: createClientId(),
    name: `APIKEY ${aiConfig.providers.volcengine.apiKeys.length + 1}`,
    apiKey: '',
    enabled: true,
    lastTestedAt: '',
    lastTestStatus: 'untested',
    lastTestMessage: ''
  });
}

function removeAiKey(apiKeyId) {
  aiConfig.providers.volcengine.apiKeys = aiConfig.providers.volcengine.apiKeys
    .filter((item) => item.id !== apiKeyId);
  visibleKeyIds.delete(apiKeyId);
  testingKeyIds.delete(apiKeyId);
}

function toggleKeyVisibility(apiKeyId) {
  if (visibleKeyIds.has(apiKeyId)) {
    visibleKeyIds.delete(apiKeyId);
    return;
  }

  visibleKeyIds.add(apiKeyId);
}

function getKeyStatusText(status) {
  if (status === 'success') {
    return '\u5df2\u901a\u8fc7';
  }

  if (status === 'error') {
    return '\u5f02\u5e38';
  }

  return '\u672a\u6d4b\u8bd5';
}

function getKeyStatusColor(status) {
  if (status === 'success') {
    return 'green';
  }

  if (status === 'error') {
    return 'red';
  }

  return 'gray';
}

function getKeyStatusDetail(apiKey) {
  if (apiKey.lastTestStatus === 'success') {
    return '';
  }

  if (apiKey.lastTestStatus === 'error') {
    return apiKey.lastTestMessage || '\u6d4b\u8bd5\u5931\u8d25\u3002';
  }

  return '\u672a\u8fdb\u884c\u6d4b\u8bd5\u3002';
}

function getKeyTestedAtLabel(apiKey) {
  if (!apiKey || !apiKey.lastTestedAt) {
    return '';
  }

  return `\u6d4b\u8bd5\u65f6\u95f4\uff1a${formatUpdatedAt(apiKey.lastTestedAt)}`;
}

async function testAiKey(apiKeyId) {
  const apiKey = aiConfig.providers.volcengine.apiKeys.find((item) => item.id === apiKeyId);

  if (!apiKey || testingKeyIds.has(apiKeyId)) {
    return;
  }

  if (!String(apiKey.apiKey || '').trim()) {
    setAiStatus('\u8bf7\u5148\u586b\u5199 APIKEY\u3002', 'error');
    return;
  }

  testingKeyIds.add(apiKeyId);
  setAiStatus('\u6b63\u5728\u6d4b\u8bd5 APIKEY');

  try {
    const result = await getGlobalConfigBridge().testAiApiKey({
      provider: aiConfig.activeProvider,
      apiBaseUrl: aiConfig.providers.volcengine.apiBaseUrl,
      model: aiConfig.providers.volcengine.model,
      apiKey: apiKey.apiKey
    });

    apiKey.lastTestedAt = result && result.testedAt ? result.testedAt : new Date().toISOString();
    apiKey.lastTestStatus = 'success';
    apiKey.lastTestMessage = result && result.message ? result.message : '\u6d4b\u8bd5\u901a\u8fc7\u3002';
    setAiStatus('\u5f53\u524d APIKEY \u6d4b\u8bd5\u901a\u8fc7\u3002', 'success');
  } catch (error) {
    apiKey.lastTestedAt = new Date().toISOString();
    apiKey.lastTestStatus = 'error';
    apiKey.lastTestMessage = getErrorMessage(error, '\u6d4b\u8bd5\u5931\u8d25\u3002');
    setAiStatus('\u5f53\u524d APIKEY \u6d4b\u8bd5\u5931\u8d25\u3002', 'error');
  } finally {
    testingKeyIds.delete(apiKeyId);
  }
}

function handleAccentThemeChange(value) {
  const matchedPreset = getAppearancePresetByKey(value) || appearancePresets[0];

  if (matchedPreset) {
    generalConfig.accentTheme = matchedPreset.key;
    appearanceConfig.primaryColor = matchedPreset.value;
  }
}

async function refresh() {
  await loadAll();
  return {
    refreshedAt: new Date().toISOString()
  };
}

onMounted(() => {
  storageConfig.providers.tencentCos.rootPrefix = storageConfig.providers.tencentCos.rootPrefix || DEFAULT_ROOT_PREFIX;
  void loadAll();
});

defineExpose({
  refresh
});
</script>

<style>
.global-config-app-shell {
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.global-config-app-sidebar,
.global-config-app-main {
  min-height: 0;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 14px 32px rgba(20, 38, 61, 0.06);
}

.global-config-app-sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.global-config-app-sidebar-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

.global-config-app-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 14px;
  background: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.12);
  color: var(--theme-primary-ink, #445468);
  font-size: 18px;
}

.global-config-app-title-group h2 {
  margin: 0;
  color: #132238;
  font-size: 18px;
  line-height: 1.3;
}

.global-config-app-title-group p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
}

.global-config-app-menu {
  border: 0;
  background: transparent;
}

.global-config-app-main {
  display: grid;
  min-height: 0;
  overflow: auto;
  padding: 18px;
}

.global-config-app-loading {
  display: grid;
  place-items: center;
  min-height: 260px;
}

.global-config-panel {
  display: grid;
  gap: 16px;
  align-content: start;
}

.global-config-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.global-config-panel-eyebrow {
  margin: 0 0 6px;
  color: var(--theme-primary-ink, #445468);
  font-size: 12px;
  font-weight: 800;
}

.global-config-panel-head h3 {
  margin: 0;
  color: #132238;
  font-size: 24px;
}

.global-config-panel-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.global-config-panel-notice {
  border-radius: 14px;
}

.global-config-provider-group {
  width: fit-content;
}

.global-config-provider-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.global-config-card {
  border-radius: 18px;
  background: #ffffff;
}

.global-config-card .arco-card-header {
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

.global-config-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.global-config-card-head .arco-switch {
  width: 40px;
  min-width: 40px;
  max-width: 40px;
  flex-shrink: 0;
}

.global-config-card-head h4 {
  margin: 0;
  color: #132238;
  font-size: 17px;
}

.global-config-card-head p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
}

.global-config-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 14px;
}

.global-config-form-full-row {
  grid-column: 1 / -1;
}

.global-config-bucket-row {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
}

.global-config-bucket-row > .arco-select {
  flex: 1;
  min-width: 0;
}

.global-config-bucket-row .arco-select-view,
.global-config-bucket-row .arco-select-trigger {
  width: 100% !important;
}

.global-config-bucket-row > .arco-btn {
  flex-shrink: 0;
  white-space: nowrap;
}

.global-config-card-actions {
  display: flex;
  justify-content: flex-start;
  margin-top: 8px;
}

.global-config-setting-section {
  display: grid;
  gap: 12px;
}

.global-config-setting-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 18px;
  align-items: center;
  min-height: 72px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: #f8fafc;
}

.global-config-setting-row > div > strong,
.global-config-setting-row > div > span {
  display: block;
}

.global-config-setting-row > div > strong {
  color: #132238;
  font-size: 14px;
}

.global-config-setting-row > div > span {
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}

.global-config-setting-control {
  width: 220px;
}

.global-config-setting-control .arco-input-label {
  display: flex;
  align-items: center;
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 8px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.global-config-setting-control .arco-input-label:hover {
  border-color: rgba(99, 102, 241, 0.5);
}

.global-config-setting-control .arco-input-label:focus-within,
.global-config-setting-control .arco-input-label.arco-input-label-focus {
  border-color: rgb(var(--primary-6));
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
}

.global-config-setting-control .arco-input-label .arco-input-label-value {
  flex: 1;
  display: flex;
  align-items: center;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.global-config-setting-control .arco-input-label .arco-input-label-prefix {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
}

.global-config-setting-control .arco-input-label .arco-input-label-suffix {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
}

.global-config-setting-switch-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.global-config-setting-switch-wrap .arco-switch {
  width: 40px;
  min-width: 40px;
  max-width: 40px;
  flex-shrink: 0;
}


.global-config-key-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-top: 4px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.global-config-key-head h5 {
  margin: 0;
  color: #132238;
  font-size: 16px;
}

.global-config-key-head p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
}

.global-config-key-list {
  display: grid;
  gap: 12px;
}

.global-config-key-card {
  border-radius: 16px;
  background: #f8fafc;
}

.global-config-key-layout {
  display: grid;
  gap: 14px;
}

.global-config-key-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.global-config-key-identity {
  display: grid;
  grid-template-columns: auto minmax(220px, 1fr);
  gap: 12px;
  align-items: center;
  flex: 1 1 420px;
  min-width: 0;
}

.global-config-key-identity .arco-switch {
  width: 40px;
  min-width: 40px;
  max-width: 40px;
  flex-shrink: 0;
}

.global-config-key-actions {
  flex: 0 0 auto;
}

.global-config-key-secret-row {
  display: grid;
}

.global-config-key-status-panel {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 14px;
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.global-config-key-status {
  display: grid;
  gap: 6px;
}

.global-config-key-status-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.global-config-key-tested-at {
  color: #64748b;
  font-size: 12px;
}

.global-config-key-detail {
  color: #64748b;
  font-size: 12px;
  line-height: 1.55;
}

.global-config-key-detail.is-success {
  color: #166534;
}

.global-config-key-detail.is-error {
  color: #b91c1c;
}

.global-config-inline-icon-button {
  padding: 0;
}

.global-config-color-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1.5px solid rgba(15, 23, 42, 0.12);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.6);
  vertical-align: middle;
  flex-shrink: 0;
}

.global-config-theme-save-button {
  transition: transform 140ms ease, box-shadow 140ms ease, filter 140ms ease;
}

.global-config-theme-save-button:hover {
  filter: brightness(1.02);
  transform: translateY(-1px);
}

body.dark-theme .global-config-app-sidebar,
body.dark-theme .global-config-app-main,
body.dark-theme .global-config-card,
body.dark-theme .global-config-key-card {
  background: rgba(15, 23, 42, 0.88);
  border-color: rgba(148, 163, 184, 0.14);
  box-shadow: none;
}

body.dark-theme .global-config-app-title-group h2,
body.dark-theme .global-config-panel-head h3,
body.dark-theme .global-config-card-head h4,
body.dark-theme .global-config-key-head h5 {
  color: #e5eefc;
}

body.dark-theme .global-config-app-title-group p,
body.dark-theme .global-config-card-head p,
body.dark-theme .global-config-setting-row > div > span,
body.dark-theme .global-config-key-head p,
body.dark-theme .global-config-key-detail,
body.dark-theme .global-config-key-tested-at {
  color: #94a3b8;
}

body.dark-theme .global-config-setting-row strong {
  color: #e5eefc;
}

body.dark-theme .global-config-key-status-panel {
  background: rgba(15, 23, 42, 0.92);
  border-color: rgba(148, 163, 184, 0.12);
}

body.dark-theme .global-config-setting-row {
  background: rgba(15, 23, 42, 0.88);
  border-color: rgba(148, 163, 184, 0.14);
}

body.dark-theme .global-config-color-dot {
  border-color: rgba(148, 163, 184, 0.24);
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.5);
}

body.dark-theme .global-config-setting-control .arco-input-label {
  background: rgba(15, 23, 42, 0.6);
  border-color: rgba(148, 163, 184, 0.24);
}

body.dark-theme .global-config-setting-control .arco-input-label:hover {
  border-color: rgba(99, 102, 241, 0.5);
}

body.dark-theme .global-config-setting-control .arco-input-label:focus-within,
body.dark-theme .global-config-setting-control .arco-input-label.arco-input-label-focus {
  border-color: rgb(var(--primary-6));
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}

@media (max-width: 1120px) {
  .global-config-app-shell {
    grid-template-columns: 1fr;
  }

  .global-config-form-grid,
  .global-config-setting-row {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 780px) {
  .global-config-app-main {
    padding: 14px;
  }

  .global-config-form-grid,
  .global-config-setting-row {
    grid-template-columns: 1fr;
  }

  .global-config-key-identity {
    grid-template-columns: 1fr;
    flex-basis: 100%;
  }

  .global-config-setting-control {
    width: 100%;
  }
}

.cos-browser-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.cos-browser-breadcrumb {
  flex: 1;
  min-width: 0;
}

.cos-browser-breadcrumb-clickable {
  cursor: pointer;
  color: var(--theme-primary-ink, #3b82f6);
}

.cos-browser-breadcrumb-clickable:hover {
  text-decoration: underline;
}

.cos-browser-path-label {
  color: #64748b;
  font-size: 12px;
  margin-bottom: 10px;
  padding: 4px 8px;
  background: #f1f5f9;
  border-radius: 4px;
  word-break: break-all;
}

.cos-browser-list {
  min-height: 200px;
  max-height: 420px;
  overflow-y: auto;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 8px;
  padding: 8px;
  position: relative;
}

.cos-browser-loading-mask {
  opacity: 0.6;
}

.cos-browser-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 160px;
  color: #94a3b8;
  font-size: 14px;
}

.cos-browser-checkbox-group {
  display: flex !important;
  flex-direction: column;
  gap: 2px;
  width: 100%;
}

.cos-browser-item {
  width: 100%;
}

.cos-browser-item-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 10px;
  border-radius: 6px;
  transition: background 0.15s;
}

.cos-browser-item-main:hover {
  background: #f8fafc;
}

.cos-browser-item-selected {
  background: rgba(59, 130, 246, 0.06);
}

.cos-browser-item-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.cos-browser-item-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.cos-browser-item-name {
  font-size: 13px;
  color: #132238;
  word-break: break-all;
  line-height: 1.4;
}

.cos-browser-item-name-link {
  cursor: pointer;
  color: var(--theme-primary-ink, #3b82f6);
}

.cos-browser-item-name-link:hover {
  text-decoration: underline;
}

.cos-browser-item-right {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
  margin-left: 12px;
}

.cos-browser-item-size {
  font-size: 12px;
  color: #64748b;
  white-space: nowrap;
  min-width: 64px;
  text-align: right;
}

.cos-browser-item-date {
  font-size: 12px;
  color: #94a3b8;
  white-space: nowrap;
  min-width: 130px;
  text-align: right;
}
</style>




