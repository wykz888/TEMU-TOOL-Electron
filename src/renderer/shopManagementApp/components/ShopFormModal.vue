<template>
  <a-modal
    :visible="visible"
    :footer="false"
    :mask-closable="false"
    width="1120px"
    unmount-on-close
    @cancel="emit('close')"
  >
    <template #title>
      {{ mode === 'edit' ? '\u7f16\u8f91\u5e97\u94fa' : '\u65b0\u589e\u5e97\u94fa' }}
    </template>

    <a-alert
      v-if="shopStatus.message"
      class="shop-mgmt-inline-status"
      :type="shopStatus.type"
      show-icon
    >
      {{ shopStatus.message }}
    </a-alert>

    <form class="shop-mgmt-form-layout" @submit.prevent="emit('submit')">
      <a-card class="shop-mgmt-form-card" :bordered="false">
        <template #title>
          &#x57fa;&#x7840;&#x4fe1;&#x606f;
        </template>

        <a-form layout="vertical" class="shop-mgmt-form-grid">
          <a-form-item label="&#x624b;&#x673a;&#x53f7;/&#x90ae;&#x7bb1;&#x8d26;&#x53f7;">
            <a-input
              :model-value="shopForm.accountValue"
              :max-length="64"
              allow-clear
              placeholder="&#x8bf7;&#x8f93;&#x5165;&#x624b;&#x673a;&#x53f7;&#x6216;&#x90ae;&#x7bb1;"
              @update:model-value="(value) => updateField('accountValue', value)"
            />
          </a-form-item>

          <a-form-item label="&#x5e97;&#x94fa;&#x540d;&#x79f0;">
            <a-input
              :model-value="shopForm.shopName"
              :max-length="80"
              allow-clear
              placeholder="&#x8bf7;&#x8f93;&#x5165;&#x5e97;&#x94fa;&#x540d;&#x79f0;"
              @update:model-value="(value) => updateField('shopName', value)"
            />
          </a-form-item>

          <a-form-item label="&#x5e73;&#x53f0;&#x5e97;&#x94fa;ID">
            <a-input
              :model-value="shopForm.platformShopId"
              readonly
              placeholder="&#x767b;&#x5f55;&#x540e;&#x81ea;&#x52a8;&#x5173;&#x8054;"
              @update:model-value="(value) => updateField('platformShopId', value)"
            />
          </a-form-item>

          <a-form-item label="&#x767b;&#x5f55;&#x5bc6;&#x7801;">
            <a-input-password
              :model-value="shopForm.loginPassword"
              :max-length="128"
              placeholder="&#x8bf7;&#x8f93;&#x5165;&#x767b;&#x5f55;&#x5bc6;&#x7801;"
              @update:model-value="(value) => updateField('loginPassword', value)"
            />
          </a-form-item>

          <a-form-item label="&#x5e97;&#x94fa;&#x5206;&#x7ec4;">
            <a-select
              :model-value="shopForm.groupId"
              :options="groupOptions"
              allow-clear
              placeholder="&#x8bf7;&#x9009;&#x62e9;&#x5206;&#x7ec4;"
              @update:model-value="(value) => updateField('groupId', value)"
            />
          </a-form-item>

          <a-form-item class="shop-mgmt-span-2" label="&#x5e97;&#x94fa;&#x5907;&#x6ce8;">
            <a-textarea
              :model-value="shopForm.note"
              :max-length="200"
              :auto-size="{ minRows: 2, maxRows: 4 }"
              placeholder="&#x8bf7;&#x8f93;&#x5165;&#x5e97;&#x94fa;&#x5907;&#x6ce8;"
              @update:model-value="(value) => updateField('note', value)"
            />
          </a-form-item>
        </a-form>

        <div class="shop-mgmt-toggle-row">
          <div class="shop-mgmt-toggle-card">
            <div>
              <strong>&#x5173;&#x95ed;&#x5e97;&#x94fa;</strong>
              <p>&#x5173;&#x95ed;&#x540e;&#xff0c;&#x8be5;&#x5e97;&#x94fa;&#x4e0d;&#x518d;&#x53c2;&#x4e0e;&#x5404;&#x7c7b;&#x4efb;&#x52a1;&#x3002;</p>
            </div>
            <a-switch
              :model-value="shopForm.isVisible"
              @update:model-value="(value) => updateField('isVisible', value)"
            />
          </div>

          <div class="shop-mgmt-toggle-card">
            <div>
              <strong>&#x6d4f;&#x89c8;&#x5668;&#x5b58;&#x50a8;&#x81ea;&#x52a8;&#x540c;&#x6b65;</strong>
              <p>&#x9996;&#x6b21;&#x8fdb;&#x5165;&#x5de5;&#x4f5c;&#x533a;&#x65f6;&#x4f1a;&#x6062;&#x590d;&#x4e91;&#x7aef;&#x5feb;&#x7167;&#x3002;</p>
            </div>
            <a-switch
              :model-value="shopForm.browserStorageAutoSyncEnabled"
              @update:model-value="(value) => updateField('browserStorageAutoSyncEnabled', value)"
            />
          </div>
        </div>
      </a-card>

      <a-card class="shop-mgmt-form-card" :bordered="false">
        <template #title>
          &#x4ee3;&#x7406;&#x8bbe;&#x7f6e;
        </template>

        <a-form layout="vertical" class="shop-mgmt-form-grid">
          <a-form-item label="&#x4ee3;&#x7406; IP &#x914d;&#x7f6e;">
            <a-select
              :model-value="shopForm.proxyType"
              :options="proxyTypeOptions"
              @update:model-value="(value) => updateField('proxyType', value)"
              @change="(value) => emit('proxy-type-change', value)"
            />
          </a-form-item>

          <template v-if="shopForm.proxyType !== 'local'">
            <a-form-item label="IP &#x5730;&#x5740;">
              <a-input
                :model-value="shopForm.proxyHost"
                :max-length="128"
                allow-clear
                @update:model-value="(value) => updateField('proxyHost', value)"
              />
            </a-form-item>

            <a-form-item label="&#x7aef;&#x53e3;">
              <a-input
                :model-value="shopForm.proxyPort"
                :max-length="8"
                allow-clear
                @update:model-value="(value) => updateField('proxyPort', value)"
              />
            </a-form-item>

            <a-form-item label="&#x7528;&#x6237;&#x8d26;&#x53f7;">
              <a-input
                :model-value="shopForm.proxyUsername"
                :max-length="64"
                allow-clear
                @update:model-value="(value) => updateField('proxyUsername', value)"
              />
            </a-form-item>

            <a-form-item label="&#x7528;&#x6237;&#x5bc6;&#x7801;">
              <a-input-password
                :model-value="shopForm.proxyPassword"
                :max-length="128"
                @update:model-value="(value) => updateField('proxyPassword', value)"
              />
            </a-form-item>

            <a-form-item class="shop-mgmt-span-2" label="&#x4ee3;&#x7406;&#x76f4;&#x8fde;&#x89c4;&#x5219;">
              <a-textarea
                :model-value="shopForm.proxyBypassRules"
                :auto-size="{ minRows: 3, maxRows: 5 }"
                placeholder=".temu.com&#10;seller.temu.com&#10;192.168.0.0/16"
                @update:model-value="(value) => updateField('proxyBypassRules', value)"
              />
            </a-form-item>

            <a-form-item class="shop-mgmt-span-2" label="&#x9759;&#x6001;&#x8d44;&#x6e90;&#x672c;&#x5730;&#x76f4;&#x8fde;">
              <div class="shop-mgmt-checkbox-row">
                <a-checkbox
                  :model-value="directResourceTypes.script"
                  @update:model-value="(value) => updateDirectResourceType('script', value)"
                >
                  JS
                </a-checkbox>
                <a-checkbox
                  :model-value="directResourceTypes.style"
                  @update:model-value="(value) => updateDirectResourceType('style', value)"
                >
                  CSS
                </a-checkbox>
                <a-checkbox
                  :model-value="directResourceTypes.font"
                  @update:model-value="(value) => updateDirectResourceType('font', value)"
                >
                  &#x5b57;&#x4f53;
                </a-checkbox>
                <a-checkbox
                  :model-value="directResourceTypes.image"
                  @update:model-value="(value) => updateDirectResourceType('image', value)"
                >
                  &#x56fe;&#x7247;
                </a-checkbox>
                <a-checkbox
                  :model-value="directResourceTypes.video"
                  @update:model-value="(value) => updateDirectResourceType('video', value)"
                >
                  &#x89c6;&#x9891;
                </a-checkbox>
              </div>
            </a-form-item>
          </template>
        </a-form>
      </a-card>

      <div class="shop-mgmt-fingerprint-hint">
        <span class="shop-mgmt-fingerprint-hint-icon">&#x1f512;</span>
        <span>&#x6bcf;&#x4e2a;&#x5e97;&#x94fa;&#x4f1a;&#x81ea;&#x52a8;&#x751f;&#x6210;&#x72ec;&#x7acb;&#x7684;&#x6d4f;&#x89c8;&#x5668;&#x6307;&#x7eb9;&#xff0c;&#x786e;&#x4fdd;&#x591a;&#x5e97;&#x94fa;&#x64cd;&#x4f5c;&#x65f6;&#x8eab;&#x4efd;&#x4e92;&#x4e0d;&#x5173;&#x8054;&#xff0c;&#x964d;&#x4f4e;&#x5e73;&#x53f0;&#x98ce;&#x63a7;&#x98ce;&#x9669;&#xff0c;&#x65e0;&#x9700;&#x624b;&#x52a8;&#x914d;&#x7f6e;&#x3002;</span>
      </div>

      <div class="shop-mgmt-modal-actions">
        <a-button @click="emit('close')">
          &#x53d6;&#x6d88;
        </a-button>
        <a-button
          html-type="submit"
          type="primary"
          :loading="shopSubmitting || shopDetailLoading"
        >
          {{ mode === 'edit' ? '\u4fdd\u5b58\u4fee\u6539' : '\u4fdd\u5b58\u5e97\u94fa' }}
        </a-button>
      </div>
    </form>
  </a-modal>
</template>

<script setup>
defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  mode: {
    type: String,
    default: 'create'
  },
  shopForm: {
    type: Object,
    required: true
  },
  groupOptions: {
    type: Array,
    default: () => []
  },
  proxyTypeOptions: {
    type: Array,
    default: () => []
  },
  directResourceTypes: {
    type: Object,
    default: () => ({})
  },
  shopStatus: {
    type: Object,
    default: () => ({ type: 'info', message: '' })
  },
  shopSubmitting: {
    type: Boolean,
    default: false
  },
  shopDetailLoading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'close',
  'submit',
  'proxy-type-change',
  'update-shop-field',
  'update-direct-resource-type'
]);

function updateField(field, value) {
  emit('update-shop-field', {
    field,
    value
  });
}

function updateDirectResourceType(key, value) {
  emit('update-direct-resource-type', {
    key,
    value
  });
}
</script>
