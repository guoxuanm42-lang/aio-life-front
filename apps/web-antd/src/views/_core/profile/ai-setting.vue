<script setup lang="ts">
import type {
  AiAgentConfig,
  AiAgentConfigSaveRequest,
  AiMemory,
  AiMemorySaveRequest,
} from '#/api/core/ai';
import type { LLMKey } from '#/api/core/llm';

import { computed, onMounted, reactive, ref } from 'vue';

import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Spin,
  Switch,
  Table,
  Tabs,
  message as antMessage,
} from 'ant-design-vue';

import {
  getAiAgentsApi,
  getAiMemoriesApi,
  saveAiAgentApi,
  saveAiMemoryApi,
  updateAiAgentStatusApi,
  updateAiMemoryApi,
  updateAiMemoryStatusApi,
} from '#/api/core/ai';
import { getLLMKeyListApi } from '#/api/core/llm';

const activeTab = ref('agent');
const agentLoading = ref(false);
const memoryLoading = ref(false);
const formLoading = ref(false);
const agents = ref<AiAgentConfig[]>([]);
const memories = ref<AiMemory[]>([]);
const llmKeys = ref<LLMKey[]>([]);

const agentFormVisible = ref(false);
const memoryFormVisible = ref(false);
const editingAgent = ref<AiAgentConfig | null>(null);
const editingMemory = ref<AiMemory | null>(null);

const memoryFilter = reactive({
  agentCode: undefined as string | undefined,
  memoryType: undefined as string | undefined,
});

const agentForm = reactive({
  code: '',
  name: '',
  description: '',
  modelKeyId: undefined as string | undefined,
  systemPrompt: '',
  maxContextMessages: 10,
  maxMemoryItems: 5,
  temperature: 0.7,
  enabled: true,
});

const memoryForm = reactive({
  agentCode: 'life_assistant',
  memoryType: 'fact',
  memoryKey: '',
  memoryValue: '',
  sourceType: '',
  sourceId: '',
  importance: 50,
  enabled: true,
});

const agentColumns = [
  { title: '编码', dataIndex: 'code', key: 'code' },
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '模型 Key', dataIndex: 'modelKeyId', key: 'modelKeyId' },
  { title: '温度', dataIndex: 'temperature', key: 'temperature' },
  { title: '上下文', dataIndex: 'maxContextMessages', key: 'maxContextMessages' },
  { title: '记忆数', dataIndex: 'maxMemoryItems', key: 'maxMemoryItems' },
  { title: '状态', dataIndex: 'enabled', key: 'enabled' },
  { title: '操作', key: 'action' },
];

const memoryColumns = [
  { title: 'Agent', dataIndex: 'agentCode', key: 'agentCode' },
  { title: '类型', dataIndex: 'memoryType', key: 'memoryType' },
  { title: 'Key', dataIndex: 'memoryKey', key: 'memoryKey' },
  { title: '内容', dataIndex: 'memoryValue', key: 'memoryValue' },
  { title: '重要性', dataIndex: 'importance', key: 'importance' },
  { title: '状态', dataIndex: 'enabled', key: 'enabled' },
  { title: '更新时间', dataIndex: 'updateTime', key: 'updateTime' },
  { title: '操作', key: 'action' },
];

const memoryTypeOptions = [
  { label: '事实', value: 'fact' },
  { label: '偏好', value: 'preference' },
  { label: '规则', value: 'rule' },
  { label: '总结', value: 'summary' },
];

const enabledAgents = computed(() =>
  agents.value.filter((agent) => agent.enabled !== false),
);

const modelNameMap = computed(() => {
  const result = new Map<string, string>();
  llmKeys.value.forEach((key) => result.set(String(key.id), key.modelName));
  return result;
});

const getAgentName = (code?: string) => {
  return agents.value.find((agent) => agent.code === code)?.name || code || '-';
};

const getModelName = (modelKeyId?: string) => {
  if (!modelKeyId) return '-';
  return modelNameMap.value.get(String(modelKeyId)) || modelKeyId;
};

const fetchAgents = async () => {
  try {
    agentLoading.value = true;
    agents.value = await getAiAgentsApi();
  } catch (error) {
    console.error('Failed to fetch AI agents:', error);
    antMessage.error('获取 AI Agent 失败');
  } finally {
    agentLoading.value = false;
  }
};

const fetchMemories = async () => {
  try {
    memoryLoading.value = true;
    memories.value = await getAiMemoriesApi({
      agentCode: memoryFilter.agentCode,
      memoryType: memoryFilter.memoryType,
    });
  } catch (error) {
    console.error('Failed to fetch AI memories:', error);
    antMessage.error('获取长期记忆失败');
  } finally {
    memoryLoading.value = false;
  }
};

const fetchLLMKeys = async () => {
  try {
    llmKeys.value = await getLLMKeyListApi();
  } catch (error) {
    console.error('Failed to fetch LLM keys:', error);
    antMessage.error('获取大模型 Key 失败');
  }
};

const resetAgentForm = (agent: AiAgentConfig) => {
  Object.assign(agentForm, {
    code: agent.code,
    name: agent.name || '',
    description: agent.description || '',
    modelKeyId: agent.modelKeyId ? String(agent.modelKeyId) : undefined,
    systemPrompt: agent.systemPrompt || '',
    maxContextMessages: agent.maxContextMessages ?? 10,
    maxMemoryItems: agent.maxMemoryItems ?? 5,
    temperature: Number(agent.temperature ?? 0.7),
    enabled: agent.enabled !== false,
  });
};

const handleEditAgent = (agent: AiAgentConfig | Record<string, any>) => {
  const currentAgent = agent as AiAgentConfig;
  editingAgent.value = currentAgent;
  resetAgentForm(currentAgent);
  agentFormVisible.value = true;
};

const handleSaveAgent = async () => {
  if (!agentForm.code) return;
  try {
    formLoading.value = true;
    const payload: AiAgentConfigSaveRequest = {
      name: agentForm.name,
      description: agentForm.description,
      modelKeyId: agentForm.modelKeyId,
      systemPrompt: agentForm.systemPrompt,
      maxContextMessages: agentForm.maxContextMessages,
      maxMemoryItems: agentForm.maxMemoryItems,
      temperature: agentForm.temperature,
    };
    const saved = await saveAiAgentApi(agentForm.code, payload);
    if (saved.enabled !== agentForm.enabled) {
      await updateAiAgentStatusApi(agentForm.code, agentForm.enabled);
    }
    antMessage.success('Agent 配置已保存');
    agentFormVisible.value = false;
    await fetchAgents();
  } catch (error) {
    console.error('Failed to save AI agent:', error);
    antMessage.error('保存 Agent 配置失败');
  } finally {
    formLoading.value = false;
  }
};

const handleAgentStatusChange = async (
  agent: AiAgentConfig | Record<string, any>,
  enabled: boolean,
) => {
  const currentAgent = agent as AiAgentConfig;
  try {
    await updateAiAgentStatusApi(currentAgent.code, enabled);
    currentAgent.enabled = enabled;
    antMessage.success(enabled ? 'Agent 已启用' : 'Agent 已禁用');
  } catch (error) {
    console.error('Failed to update AI agent status:', error);
    antMessage.error('更新 Agent 状态失败');
    await fetchAgents();
  }
};

const resetMemoryForm = (memory?: AiMemory) => {
  Object.assign(memoryForm, {
    agentCode:
      memory?.agentCode ||
      memoryFilter.agentCode ||
      agents.value[0]?.code ||
      'life_assistant',
    memoryType: memory?.memoryType || 'fact',
    memoryKey: memory?.memoryKey || '',
    memoryValue: memory?.memoryValue || '',
    sourceType: memory?.sourceType || '',
    sourceId: memory?.sourceId || '',
    importance: memory?.importance ?? 50,
    enabled: memory?.enabled !== false,
  });
};

const handleAddMemory = () => {
  editingMemory.value = null;
  resetMemoryForm();
  memoryFormVisible.value = true;
};

const handleEditMemory = (memory: AiMemory | Record<string, any>) => {
  const currentMemory = memory as AiMemory;
  editingMemory.value = currentMemory;
  resetMemoryForm(currentMemory);
  memoryFormVisible.value = true;
};

const handleSaveMemory = async () => {
  if (!memoryForm.memoryKey.trim() || !memoryForm.memoryValue.trim()) {
    antMessage.error('请填写记忆 Key 和记忆内容');
    return;
  }

  try {
    formLoading.value = true;
    const payload: AiMemorySaveRequest = {
      agentCode: memoryForm.agentCode,
      memoryType: memoryForm.memoryType,
      memoryKey: memoryForm.memoryKey,
      memoryValue: memoryForm.memoryValue,
      sourceType: memoryForm.sourceType,
      sourceId: memoryForm.sourceId,
      importance: memoryForm.importance,
    };
    const saved = editingMemory.value?.id
      ? await updateAiMemoryApi(editingMemory.value.id, payload)
      : await saveAiMemoryApi(payload);
    if (saved.id && saved.enabled !== memoryForm.enabled) {
      await updateAiMemoryStatusApi(saved.id, memoryForm.enabled);
    }
    antMessage.success('长期记忆已保存');
    memoryFormVisible.value = false;
    await fetchMemories();
  } catch (error) {
    console.error('Failed to save AI memory:', error);
    antMessage.error('保存长期记忆失败');
  } finally {
    formLoading.value = false;
  }
};

const handleMemoryStatusChange = async (
  memory: AiMemory | Record<string, any>,
  enabled: boolean,
) => {
  const currentMemory = memory as AiMemory;
  if (!currentMemory.id) return;
  try {
    await updateAiMemoryStatusApi(currentMemory.id, enabled);
    currentMemory.enabled = enabled;
    antMessage.success(enabled ? '记忆已启用' : '记忆已禁用');
  } catch (error) {
    console.error('Failed to update AI memory status:', error);
    antMessage.error('更新记忆状态失败');
    await fetchMemories();
  }
};

onMounted(async () => {
  await Promise.all([fetchAgents(), fetchLLMKeys()]);
  await fetchMemories();
});
</script>

<template>
  <div class="p-4 lg:p-6">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-bold lg:text-2xl">AI 设置</h1>
    </div>

    <Tabs v-model:active-key="activeTab">
      <Tabs.TabPane key="agent" tab="Agent 配置">
        <Spin :spinning="agentLoading">
          <Table
            :columns="agentColumns"
            :data-source="agents"
            :scroll="{ x: 'max-content' }"
            row-key="code"
          >
            <template #bodyCell="{ column, record, text }">
              <template v-if="column.key === 'modelKeyId'">
                {{ getModelName(record.modelKeyId) }}
              </template>
              <template v-else-if="column.key === 'enabled'">
                <Switch
                  :checked="record.enabled !== false"
                  @change="(checked) => handleAgentStatusChange(record, Boolean(checked))"
                />
              </template>
              <template v-else-if="column.key === 'action'">
                <Button type="link" size="small" @click="handleEditAgent(record)">
                  编辑
                </Button>
              </template>
              <template v-else>
                {{ text ?? '-' }}
              </template>
            </template>
          </Table>
        </Spin>
      </Tabs.TabPane>

      <Tabs.TabPane key="memory" tab="长期记忆">
        <div class="mb-4 flex flex-wrap items-center gap-3">
          <Select
            v-model:value="memoryFilter.agentCode"
            allow-clear
            class="w-48"
            placeholder="按 Agent 筛选"
            @change="fetchMemories"
          >
            <Select.Option
              v-for="agent in agents"
              :key="agent.code"
              :value="agent.code"
            >
              {{ agent.name || agent.code }}
            </Select.Option>
          </Select>
          <Select
            v-model:value="memoryFilter.memoryType"
            allow-clear
            class="w-40"
            placeholder="按类型筛选"
            @change="fetchMemories"
          >
            <Select.Option
              v-for="item in memoryTypeOptions"
              :key="item.value"
              :value="item.value"
            >
              {{ item.label }}
            </Select.Option>
          </Select>
          <Button type="primary" @click="handleAddMemory">新增记忆</Button>
        </div>

        <Spin :spinning="memoryLoading">
          <Table
            :columns="memoryColumns"
            :data-source="memories"
            :scroll="{ x: 'max-content' }"
            row-key="id"
          >
            <template #bodyCell="{ column, record, text }">
              <template v-if="column.key === 'agentCode'">
                {{ getAgentName(record.agentCode) }}
              </template>
              <template v-else-if="column.key === 'memoryValue'">
                <span class="line-clamp-2 max-w-md">{{ record.memoryValue }}</span>
              </template>
              <template v-else-if="column.key === 'enabled'">
                <Switch
                  :checked="record.enabled !== false"
                  @change="(checked) => handleMemoryStatusChange(record, Boolean(checked))"
                />
              </template>
              <template v-else-if="column.key === 'action'">
                <Button type="link" size="small" @click="handleEditMemory(record)">
                  编辑
                </Button>
              </template>
              <template v-else>
                {{ text ?? '-' }}
              </template>
            </template>
          </Table>
        </Spin>
      </Tabs.TabPane>
    </Tabs>

    <Modal
      v-model:open="agentFormVisible"
      title="编辑 Agent"
      width="720px"
      :confirm-loading="formLoading"
      @ok="handleSaveAgent"
    >
      <Form layout="vertical" class="mt-4">
        <Form.Item label="Agent 编码">
          <Input v-model:value="agentForm.code" disabled />
        </Form.Item>
        <Form.Item label="名称" required>
          <Input v-model:value="agentForm.name" placeholder="请输入 Agent 名称" />
        </Form.Item>
        <Form.Item label="描述">
          <Input v-model:value="agentForm.description" placeholder="请输入描述" />
        </Form.Item>
        <Form.Item label="模型 Key">
          <Select
            v-model:value="agentForm.modelKeyId"
            allow-clear
            placeholder="请选择模型 Key"
          >
            <Select.Option
              v-for="key in llmKeys"
              :key="key.id"
              :value="String(key.id)"
            >
              {{ key.modelName }}{{ key.isDefault ? '（默认）' : '' }}
            </Select.Option>
          </Select>
        </Form.Item>
        <Form.Item label="系统提示词">
          <Input.TextArea
            v-model:value="agentForm.systemPrompt"
            :auto-size="{ minRows: 5, maxRows: 10 }"
            placeholder="请输入系统提示词"
          />
        </Form.Item>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Form.Item label="温度">
            <InputNumber
              v-model:value="agentForm.temperature"
              class="w-full"
              :min="0"
              :max="2"
              :step="0.1"
            />
          </Form.Item>
          <Form.Item label="上下文条数">
            <InputNumber
              v-model:value="agentForm.maxContextMessages"
              class="w-full"
              :min="0"
              :max="100"
            />
          </Form.Item>
          <Form.Item label="长期记忆条数">
            <InputNumber
              v-model:value="agentForm.maxMemoryItems"
              class="w-full"
              :min="0"
              :max="100"
            />
          </Form.Item>
        </div>
        <Form.Item label="启用状态">
          <Switch v-model:checked="agentForm.enabled" />
        </Form.Item>
      </Form>
    </Modal>

    <Modal
      v-model:open="memoryFormVisible"
      :title="editingMemory ? '编辑长期记忆' : '新增长期记忆'"
      width="680px"
      :confirm-loading="formLoading"
      @ok="handleSaveMemory"
    >
      <Form layout="vertical" class="mt-4">
        <Form.Item label="Agent" required>
          <Select v-model:value="memoryForm.agentCode" placeholder="请选择 Agent">
            <Select.Option
              v-for="agent in agents"
              :key="agent.code"
              :value="agent.code"
            >
              {{ agent.name || agent.code }}
            </Select.Option>
          </Select>
        </Form.Item>
        <Form.Item label="记忆类型" required>
          <Select v-model:value="memoryForm.memoryType">
            <Select.Option
              v-for="item in memoryTypeOptions"
              :key="item.value"
              :value="item.value"
            >
              {{ item.label }}
            </Select.Option>
          </Select>
        </Form.Item>
        <Form.Item label="记忆 Key" required>
          <Input v-model:value="memoryForm.memoryKey" placeholder="请输入记忆 Key" />
        </Form.Item>
        <Form.Item label="记忆内容" required>
          <Input.TextArea
            v-model:value="memoryForm.memoryValue"
            :auto-size="{ minRows: 4, maxRows: 8 }"
            placeholder="请输入记忆内容"
          />
        </Form.Item>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Form.Item label="来源类型">
            <Input v-model:value="memoryForm.sourceType" placeholder="可选" />
          </Form.Item>
          <Form.Item label="来源 ID">
            <Input v-model:value="memoryForm.sourceId" placeholder="可选" />
          </Form.Item>
          <Form.Item label="重要性">
            <InputNumber
              v-model:value="memoryForm.importance"
              class="w-full"
              :min="0"
              :max="100"
            />
          </Form.Item>
        </div>
        <Form.Item label="启用状态">
          <Switch v-model:checked="memoryForm.enabled" />
        </Form.Item>
      </Form>
    </Modal>
  </div>
</template>

<style scoped>
:deep(.ant-table-wrapper) {
  @apply overflow-hidden rounded-xl bg-card;
}
</style>
