<script setup lang="ts">
import { computed, ref } from 'vue';

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue';
import { Button, Form, Input, Select } from 'ant-design-vue';

type ThemeKey = 'blue' | 'cyan' | 'green' | 'indigo' | 'orange' | 'pink' | 'purple' | 'teal';

interface ThoughtEvent {
  content: string;
  create_time: string;
  id: number | string;
}

interface ThoughtForm {
  content: string;
  events: ThoughtEvent[];
  subject: string;
  themeKey: '' | ThemeKey;
}

interface ThoughtActionDetailForm {
  archiveReason: string;
  archiveType: string;
  nextAction: string;
  reflection: string;
  restartPolicy: string;
  resultSummary: string;
  shelveReason: string;
  shelveReasonTag: string;
  valueLevel: string;
}

interface OptionItem {
  label: string;
  value: string;
}

const props = defineProps<{
  archiveTypeOptions: OptionItem[];
  currentStatus?: string;
  detail: ThoughtActionDetailForm;
  form: ThoughtForm;
  formatDate: (dateString: string) => string;
  getCategoryTitleByThemeKey: (key?: string) => string;
  hasPendingWorkflowChange?: boolean;
  mode: 'edit' | 'view';
  onAddEvent?: () => void;
  onRemoveEvent?: (id: number | string) => void;
  pendingWorkflowActionKey?: string;
  pendingWorkflowTargetStatus?: string;
  restartPolicyOptions: OptionItem[];
  shelveReasonTagOptions: OptionItem[];
  thoughtThemePresets: Array<{ key: ThemeKey }>;
  valueLevelOptions: OptionItem[];
}>();

const isEventsOpen = ref(false);

const getOptionLabel = (options: OptionItem[], value?: string) =>
  options.find((item) => item.value === value)?.label ?? '';

const getSummaryItems = () =>
  [
    ['处理结果', props.detail.resultSummary],
    ['后续动作', props.detail.nextAction],
    ['价值等级', getOptionLabel(props.valueLevelOptions, props.detail.valueLevel)],
    ['沉淀类型', getOptionLabel(props.archiveTypeOptions, props.detail.archiveType)],
    ['归档原因', props.detail.archiveReason],
    ['心得/复盘', props.detail.reflection],
    ['搁置原因', props.detail.shelveReason],
    ['搁置标签', getOptionLabel(props.shelveReasonTagOptions, props.detail.shelveReasonTag)],
    ['是否可重启', getOptionLabel(props.restartPolicyOptions, props.detail.restartPolicy)],
  ].filter(([, value]) => String(value ?? '').trim() !== '');

const eventCount = computed(
  () => props.form.events.filter((event) => event.content.trim() !== '').length,
);

const actionKey = computed(() => props.pendingWorkflowActionKey ?? '');

const shouldShowNextAction = computed(
  () =>
    (!props.hasPendingWorkflowChange && props.currentStatus === 'pending') ||
    ['back-pending', 'reopen', 'restart', 'start'].includes(actionKey.value),
);
const shouldShowDoneFields = computed(() => actionKey.value === 'done');
const shouldShowShelveFields = computed(() => actionKey.value === 'shelve');
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
    <Form.Item label="主题" required>
      <Input
        v-model:value="form.subject"
        :maxlength="60"
        allow-clear
        placeholder="给这条想法一个清晰主题"
      />
    </Form.Item>

    <Form.Item label="内容" class="thought-editor-full">
      <Input.TextArea
        v-model:value="form.content"
        :auto-size="{ minRows: 4, maxRows: 10 }"
        class="content-textarea"
        placeholder="记录具体想法、要做的事或上下文..."
      />
    </Form.Item>

    <Form.Item label="分类" required class="thought-editor-full">
      <div class="modal-type-capsule">
        <button
          v-for="item in thoughtThemePresets"
          :key="item.key"
          type="button"
          class="modal-capsule-item"
          :class="{ 'is-active': form.themeKey === item.key }"
          @click="form.themeKey = item.key"
        >
          {{ getCategoryTitleByThemeKey(item.key) }}
        </button>
      </div>
    </Form.Item>

    <Form.Item v-if="shouldShowDoneFields" label="处理结果" class="thought-editor-full">
      <Input.TextArea v-model:value="detail.resultSummary" :auto-size="{ minRows: 2, maxRows: 5 }" />
    </Form.Item>
    <Form.Item v-if="shouldShowDoneFields" label="心得/复盘" class="thought-editor-full">
      <Input.TextArea v-model:value="detail.reflection" :auto-size="{ minRows: 2, maxRows: 5 }" />
    </Form.Item>
    <Form.Item v-if="shouldShowNextAction || shouldShowDoneFields" label="后续动作" class="thought-editor-full">
      <Input.TextArea v-model:value="detail.nextAction" :auto-size="{ minRows: 2, maxRows: 5 }" />
    </Form.Item>
    <Form.Item v-if="shouldShowShelveFields" label="搁置原因" class="thought-editor-full">
      <Input.TextArea v-model:value="detail.shelveReason" :auto-size="{ minRows: 2, maxRows: 5 }" />
    </Form.Item>
    <Form.Item v-if="shouldShowShelveFields" label="搁置原因标签">
      <Select v-model:value="detail.shelveReasonTag" :options="shelveReasonTagOptions" allow-clear />
    </Form.Item>
    <Form.Item v-if="shouldShowShelveFields" label="是否可重启">
      <Select v-model:value="detail.restartPolicy" :options="restartPolicyOptions" allow-clear />
    </Form.Item>
    <Form.Item v-if="shouldShowArchiveFields" label="归档原因" class="thought-editor-full">
      <Input.TextArea v-model:value="detail.archiveReason" :auto-size="{ minRows: 2, maxRows: 5 }" />
    </Form.Item>
    <Form.Item v-if="shouldShowArchiveFields" label="价值等级">
      <Select v-model:value="detail.valueLevel" :options="valueLevelOptions" allow-clear />
    </Form.Item>
    <Form.Item v-if="shouldShowArchiveFields" label="沉淀类型">
      <Select v-model:value="detail.archiveType" :options="archiveTypeOptions" allow-clear />
    </Form.Item>

    <div class="events-section thought-editor-full">
      <button class="events-header" type="button" @click="isEventsOpen = !isEventsOpen">
        <span class="events-title">关联事件 {{ eventCount }} 个</span>
        <span class="events-toggle">{{ isEventsOpen ? '收起' : '展开' }}</span>
      </button>
      <template v-if="isEventsOpen">
        <div v-for="event in [...form.events].reverse()" :key="event.id" class="event-item">
          <div class="event-row">
            <Input
              v-model:value="event.content"
              placeholder="记录相关事件..."
              :bordered="false"
              class="event-input"
            />
            <Button
              v-if="form.events.length > 1"
              type="text"
              danger
              shape="circle"
              @click="onRemoveEvent?.(event.id)"
            >
              <template #icon><DeleteOutlined /></template>
            </Button>
          </div>
          <div class="event-time">{{ formatDate(event.create_time) }}</div>
        </div>
        <Button type="dashed" block class="add-event-btn" @click="onAddEvent?.()">
          <template #icon><PlusOutlined /></template>
          补充事件
        </Button>
      </template>
    </div>
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

.modal-type-capsule {
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
  min-height: 34px;
  padding: 0 16px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: rgb(0 0 0 / 0.68);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}

.modal-capsule-item.is-active {
  color: rgb(var(--thought-accent-rgb) / 1);
  background: rgb(var(--thought-accent-rgb) / 0.14);
}

.events-section {
  margin-top: 8px;
}

.events-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgb(0 0 0 / 0.06);
  border-radius: 12px;
  background: rgb(255 255 255 / 0.66);
  color: rgb(0 0 0 / 0.62);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}

.events-toggle {
  color: rgb(var(--thought-accent-rgb) / 0.92);
  font-size: 13px;
  font-weight: 700;
}

.event-item {
  padding: 12px 16px;
  margin-top: 12px;
  background: rgb(128 128 128 / 4%);
  border-radius: 14px;
}

.event-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.event-input {
  flex: 1;
  padding: 0;
  font-size: 14px;
  background: transparent;
}

.event-time {
  margin-top: 6px;
  font-size: 12px;
  color: rgb(0 0 0 / 0.42);
}

.add-event-btn {
  height: 42px;
  margin-top: 12px;
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

  .content-textarea,
  .event-input {
    font-size: 16px;
  }

  .modal-capsule-item,
  .events-header {
    min-height: 40px;
    font-size: 15px;
  }
}
</style>
