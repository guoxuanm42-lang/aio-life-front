<script setup lang="ts">
import { computed } from 'vue';

import { Form, Input, Select } from 'ant-design-vue';

interface ThoughtForm {
  content: string;
  subject: string;
}

interface ThoughtReflectionDetailForm {
  archiveType: string;
  improvementAction: string;
  lessonType: string;
  reflectionSummary: string;
  relatedProject: string;
  tags: string;
  valueLevel: string;
}

interface OptionItem {
  label: string;
  value: string;
}

const props = defineProps<{
  archiveTypeOptions: OptionItem[];
  currentStatus?: string;
  detail: ThoughtReflectionDetailForm;
  form: ThoughtForm;
  hasPendingWorkflowChange?: boolean;
  lessonTypeOptions: OptionItem[];
  mode: 'edit' | 'view';
  pendingWorkflowActionKey?: string;
  pendingWorkflowTargetStatus?: string;
  valueLevelOptions: OptionItem[];
}>();

const getOptionLabel = (options: OptionItem[], value?: string) =>
  options.find((item) => item.value === value)?.label ?? '';

const getSummaryItems = () =>
  [
    ['复盘结论', props.detail.reflectionSummary],
    ['价值等级', getOptionLabel(props.valueLevelOptions, props.detail.valueLevel)],
    ['沉淀类型', getOptionLabel(props.archiveTypeOptions, props.detail.archiveType)],
    ['标签', props.detail.tags],
    ['改进动作', props.detail.improvementAction],
    ['类型', getOptionLabel(props.lessonTypeOptions, props.detail.lessonType)],
    ['关联项目', props.detail.relatedProject],
  ].filter(([, value]) => String(value ?? '').trim() !== '');

const actionKey = computed(() => props.pendingWorkflowActionKey ?? '');
const shouldShowStartFields = computed(() => actionKey.value === 'start');
const shouldShowSettleFields = computed(() => actionKey.value === 'settle');
const shouldShowArchiveFields = computed(() => actionKey.value === 'archive');
const shouldShowReworkFields = computed(() => actionKey.value === 'rework');
</script>

<template>
  <div v-if="mode === 'view'">
    <div v-if="getSummaryItems().length > 0" class="thought-editor-summary-list">
      <div
        v-for="[label, value] in getSummaryItems()"
        :key="label"
        class="thought-editor-summary-item"
      >
        <span>{{ label }}</span>
        <strong>{{ value }}</strong>
      </div>
    </div>
    <div v-else class="thought-editor-empty">暂无扩展信息</div>
  </div>

  <div v-else class="thought-editor-form">
    <Form.Item label="复盘主题" required class="thought-editor-full">
      <Input
        v-model:value="form.subject"
        :maxlength="60"
        allow-clear
        placeholder="这次复盘的主题"
      />
    </Form.Item>
    <Form.Item label="复盘内容" class="thought-editor-full">
      <Input.TextArea
        v-model:value="form.content"
        :auto-size="{ minRows: 5, maxRows: 12 }"
        class="content-textarea"
        placeholder="记录过程、背景、判断和关键事实..."
      />
    </Form.Item>
    <Form.Item v-if="shouldShowSettleFields" label="复盘结论" class="thought-editor-full">
      <Input.TextArea v-model:value="detail.reflectionSummary" :auto-size="{ minRows: 2, maxRows: 5 }" />
    </Form.Item>
    <Form.Item v-if="shouldShowStartFields" label="经验/教训/方法/决策">
      <Select v-model:value="detail.lessonType" :options="lessonTypeOptions" allow-clear />
    </Form.Item>
    <Form.Item v-if="shouldShowSettleFields || shouldShowArchiveFields" label="沉淀类型">
      <Select v-model:value="detail.archiveType" :options="archiveTypeOptions" allow-clear />
    </Form.Item>
    <Form.Item v-if="shouldShowSettleFields || shouldShowArchiveFields" label="价值等级">
      <Select v-model:value="detail.valueLevel" :options="valueLevelOptions" allow-clear />
    </Form.Item>
    <Form.Item v-if="shouldShowSettleFields || shouldShowReworkFields" label="改进动作" class="thought-editor-full">
      <Input.TextArea v-model:value="detail.improvementAction" :auto-size="{ minRows: 2, maxRows: 5 }" />
    </Form.Item>
    <Form.Item v-if="shouldShowArchiveFields" label="标签" class="thought-editor-full">
      <Input v-model:value="detail.tags" allow-clear placeholder="多个标签可用逗号分隔" />
    </Form.Item>
  </div>
</template>

<style scoped>
.thought-editor-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
}

.thought-editor-form :deep(.ant-form-item) {
  margin-bottom: 12px;
}

.thought-editor-full {
  grid-column: 1 / -1;
}

.content-textarea {
  padding: 12px 16px;
  font-size: 15px;
  line-height: 1.6;
  resize: none;
  background: rgb(128 128 128 / 4%);
  border-radius: 12px;
}

.thought-editor-summary-list {
  display: grid;
  gap: 8px;
}

.thought-editor-summary-item {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid rgb(0 0 0 / 0.06);
  border-radius: 12px;
  background: rgb(255 255 255 / 0.64);
}

.thought-editor-summary-item span {
  font-size: 12px;
  color: rgb(0 0 0 / 0.45);
}

.thought-editor-summary-item strong {
  font-size: 13px;
  font-weight: 600;
  color: rgb(0 0 0 / 0.74);
  white-space: pre-wrap;
  word-break: break-word;
}

.thought-editor-empty {
  padding: 12px 14px;
  border: 1px solid rgb(0 0 0 / 0.06);
  border-radius: 14px;
  font-size: 13px;
  color: rgb(0 0 0 / 0.52);
  background: rgb(255 255 255 / 0.62);
}

@media (max-width: 768px) {
  .thought-editor-form {
    grid-template-columns: 1fr;
  }

  .thought-editor-form :deep(.ant-form-item-label > label) {
    font-size: 15px;
  }

  .content-textarea {
    font-size: 16px;
  }
}
</style>
