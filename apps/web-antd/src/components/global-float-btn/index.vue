<script setup lang="ts">
import { PlusOutlined } from '@ant-design/icons-vue';
import { FloatButton } from 'ant-design-vue';

// 定义组件的 emits，透传 click 事件
defineEmits(['click']);
</script>

<template>
  <FloatButton class="global-float-btn" @click="$emit('click')">
    <template #icon>
      <PlusOutlined class="global-plus-icon" />
    </template>
  </FloatButton>
</template>
