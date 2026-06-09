<script lang="ts" setup>
import { Page } from '@vben/common-ui';

import { Alert } from 'ant-design-vue';

interface Props {
  error?: boolean;
  errorMessage?: string;
  loading?: boolean;
}

withDefaults(defineProps<Props>(), {
  error: false,
  errorMessage: '加载失败，请检查网络连接或绑定信息。',
  loading: false,
});
</script>

<template>
  <Page content-class="p-0" title="">
    <div class="p-4 md:p-7">
      <template v-if="loading">
        <slot name="skeleton"></slot>
      </template>

      <template v-else-if="error">
        <div class="w-full py-12 text-center">
          <Alert
            class="inline-block text-left"
            :description="errorMessage"
            message="加载失败"
            show-icon
            type="error"
          />
        </div>
      </template>

      <template v-else>
        <slot></slot>
      </template>
    </div>
  </Page>
</template>
