<script lang="ts" setup>
import { Card, Spin } from 'ant-design-vue';

interface Props {
  emptyText?: string;
  isEmpty?: boolean;
  loading?: boolean;
  title?: string;
}

withDefaults(defineProps<Props>(), {
  emptyText: '暂无数据',
  isEmpty: false,
  loading: false,
  title: undefined,
});
</script>

<template>
  <div class="flex h-full flex-col">
    <div
      v-if="title || $slots.extra"
      class="mb-4 flex items-center justify-between gap-3"
    >
      <h3
        v-if="title"
        class="m-0 text-lg font-medium text-gray-800 dark:text-gray-200"
      >
        {{ title }}
      </h3>
      <slot name="extra"></slot>
    </div>

    <Card
      :bordered="false"
      class="flex min-h-0 flex-1 flex-col shadow-sm"
      :body-style="{
        padding: '0',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }"
    >
      <div v-if="loading" class="flex justify-center p-8">
        <Spin />
      </div>
      <div v-else-if="isEmpty" class="p-8 text-center text-gray-500">
        {{ emptyText }}
      </div>
      <div v-else class="flex-1 overflow-y-auto">
        <slot></slot>
      </div>
    </Card>
  </div>
</template>
