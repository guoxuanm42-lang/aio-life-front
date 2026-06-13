<script setup lang="ts">
import { computed } from 'vue';

import { Form, Input, Select } from 'ant-design-vue';

interface ThoughtForm {
  content: string;
}

interface ThoughtEmotionDetailForm {
  copingAction: string;
  emotionIntensity: number | undefined;
  emotionNeed: string;
  emotionTrigger: string;
  emotionType: string;
  ignoredReason: string;
  reflectionSummary: string;
}

interface OptionItem {
  label: string;
  value: string;
}

const props = defineProps<{
  currentStatus?: string;
  detail: ThoughtEmotionDetailForm;
  emotionIntensityOptions: number[];
  emotionTypeOptions: OptionItem[];
  form: ThoughtForm;
  hasPendingWorkflowChange?: boolean;
  mode: 'edit' | 'view';
  pendingWorkflowActionKey?: string;
  pendingWorkflowTargetStatus?: string;
}>();

const getOptionLabel = (options: OptionItem[], value?: string) =>
  options.find((item) => item.value === value)?.label ?? '';

const getSummaryItems = () =>
  [
    ['情绪类型', getOptionLabel(props.emotionTypeOptions, props.detail.emotionType)],
    ['情绪强度', props.detail.emotionIntensity ? `${props.detail.emotionIntensity}/5` : ''],
    ['发生了什么', props.detail.emotionTrigger],
    ['背后需求', props.detail.emotionNeed],
    ['缓解动作', props.detail.copingAction],
    ['复盘结论', props.detail.reflectionSummary],
    ['不再关注原因', props.detail.ignoredReason],
  ].filter(([, value]) => String(value ?? '').trim() !== '');

const actionKey = computed(() => props.pendingWorkflowActionKey ?? '');
const shouldShowObserveFields = computed(() => actionKey.value === 'observe');
const shouldShowRelievedFields = computed(() => actionKey.value === 'relieved');
const shouldShowIgnoredFields = computed(() => actionKey.value === 'ignore');
const shouldShowArchiveFields = computed(() => actionKey.value === 'archive');
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
    <Form.Item label="我现在的感受" required class="thought-editor-full">
      <Input.TextArea
        v-model:value="form.content"
        :auto-size="{ minRows: 5, maxRows: 12 }"
        class="content-textarea"
        placeholder="记录此刻的情绪、感受和身体反应..."
      />
    </Form.Item>
    <Form.Item label="情绪类型">
      <Select v-model:value="detail.emotionType" :options="emotionTypeOptions" allow-clear />
    </Form.Item>
    <Form.Item label="情绪强度">
      <div class="emotion-intensity-capsule">
        <button
          v-for="value in emotionIntensityOptions"
          :key="value"
          type="button"
          class="modal-capsule-item"
          :class="{ 'is-active': detail.emotionIntensity === value }"
          @click="detail.emotionIntensity = value"
        >
          {{ value }}
        </button>
      </div>
    </Form.Item>
    <Form.Item v-if="shouldShowObserveFields" label="发生了什么" class="thought-editor-full">
      <Input.TextArea v-model:value="detail.emotionTrigger" :auto-size="{ minRows: 2, maxRows: 5 }" />
    </Form.Item>
    <Form.Item v-if="shouldShowObserveFields || shouldShowArchiveFields" label="背后需求" class="thought-editor-full">
      <Input.TextArea v-model:value="detail.emotionNeed" :auto-size="{ minRows: 2, maxRows: 5 }" />
    </Form.Item>
    <Form.Item v-if="shouldShowRelievedFields || shouldShowArchiveFields" label="缓解动作" class="thought-editor-full">
      <Input.TextArea v-model:value="detail.copingAction" :auto-size="{ minRows: 2, maxRows: 5 }" />
    </Form.Item>
    <Form.Item v-if="shouldShowRelievedFields || shouldShowArchiveFields" label="复盘结论" class="thought-editor-full">
      <Input.TextArea v-model:value="detail.reflectionSummary" :auto-size="{ minRows: 2, maxRows: 5 }" />
    </Form.Item>
    <Form.Item v-if="shouldShowIgnoredFields" label="不再关注原因" class="thought-editor-full">
      <Input.TextArea v-model:value="detail.ignoredReason" :auto-size="{ minRows: 2, maxRows: 5 }" />
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

.emotion-intensity-capsule {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 5px;
  border: 1px solid rgb(0 0 0 / 0.06);
  border-radius: 999px;
  background: rgb(255 255 255 / 0.78);
  box-shadow:
    0 10px 22px rgb(0 0 0 / 0.06),
    inset 0 1px 0 rgb(255 255 255 / 0.8);
}

.modal-capsule-item {
  min-width: 34px;
  min-height: 34px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: rgb(0 0 0 / 0.68);
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
}

.modal-capsule-item.is-active {
  color: rgb(var(--thought-accent-rgb) / 1);
  background: rgb(var(--thought-accent-rgb) / 0.14);
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

  .modal-capsule-item {
    min-height: 40px;
    font-size: 15px;
  }
}
</style>
