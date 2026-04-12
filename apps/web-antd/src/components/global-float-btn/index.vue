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

<style scoped lang="less">
.global-float-btn {
  /* 添加基础的悬浮动画过渡，使按钮更灵动 */
  transition: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);

  /* 设置图标的基础动画属性 */
  :deep(.global-plus-icon) {
    transition: transform 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);
  }

  /* 悬浮时的动画效果 */
  &:hover {
    /* 图标旋转 180 度并稍微放大 */
    :deep(.global-plus-icon) {
      transform: rotate(180deg) scale(1.15);
    }
  }
}
</style>
