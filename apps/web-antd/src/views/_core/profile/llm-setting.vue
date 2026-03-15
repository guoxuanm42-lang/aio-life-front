<script setup lang="ts">
import { computed, onMounted, ref, reactive, onUnmounted } from 'vue';
import { message as antMessage } from 'ant-design-vue';
import {
  getLLMKeyListApi,
  saveLLMKeyApi,
  updateLLMKeyApi,
  deleteLLMKeyApi,
  setDefaultLLMKeyApi,
  type LLMKey,
} from '#/api/core/llm';

const dropdownRef = ref<HTMLElement | null>(null);

const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    showPresetDropdown.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  fetchLLMKeys();
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

const loading = ref(false);
const llmKeys = ref<LLMKey[]>([]);
const formVisible = ref(false);
const formLoading = ref(false);
const showPresetDropdown = ref(false);

const formData = reactive({
  id: '',
  modelName: 'gpt-3.5-turbo',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  isDefault: 0,
});

// 预置大模型选项
const presetModels = [
  { label: 'OpenAI', value: 'gpt-3.5-turbo', baseUrl: 'https://api.openai.com/v1' },
  { label: '阿里百炼', value: 'qwen-turbo', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3' },
  { label: 'DeepSeek', value: 'deepseek-chat', baseUrl: 'https://api.deepseek.com/v1' },
];

const fetchLLMKeys = async () => {
  try {
    loading.value = true;
    llmKeys.value = await getLLMKeyListApi();
  } catch (error) {
    console.error('Failed to fetch LLM keys:', error);
    antMessage.error('获取大模型配置失败');
  } finally {
    loading.value = false;
  }
};

const handleAdd = () => {
  Object.assign(formData, {
    id: '',
    modelName: 'gpt-3.5-turbo',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    isDefault: 0,
  });
  formVisible.value = true;
};

const handleEdit = (key: LLMKey) => {
  Object.assign(formData, key);
  formVisible.value = true;
};

const handleDelete = async (id: string) => {
  try {
    loading.value = true;
    await deleteLLMKeyApi(id);
    antMessage.success('删除成功');
    await fetchLLMKeys();
  } catch (error) {
    console.error('Failed to delete LLM key:', error);
    antMessage.error('删除失败');
  } finally {
    loading.value = false;
  }
};

const handleSetDefault = async (id: string) => {
  try {
    loading.value = true;
    await setDefaultLLMKeyApi(id);
    antMessage.success('设置默认成功');
    await fetchLLMKeys();
  } catch (error) {
    console.error('Failed to set default LLM key:', error);
    antMessage.error('设置默认失败');
  } finally {
    loading.value = false;
  }
};

const handleSubmit = async () => {
  try {
    formLoading.value = true;
    const submitData = {
      ...formData,
      isDefault: formData.isDefault ? 1 : 0,
    };
    if (formData.id) {
      await updateLLMKeyApi(submitData);
      antMessage.success('更新成功');
    } else {
      await saveLLMKeyApi(submitData);
      antMessage.success('保存成功');
    }
    formVisible.value = false;
    await fetchLLMKeys();
  } catch (error) {
    console.error('Failed to save LLM key:', error);
    antMessage.error('保存失败');
  } finally {
    formLoading.value = false;
  }
};

const selectPresetModel = (model: any) => {
  formData.modelName = model.value;
  formData.baseUrl = model.baseUrl;
  showPresetDropdown.value = false;
};

const handleModelChange = (modelName: string) => {
  const preset = presetModels.find(m => m.value === modelName);
  if (preset) {
    formData.baseUrl = preset.baseUrl;
  }
};
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-800">大模型配置</h1>
      <button
        class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        @click="handleAdd"
      >
        添加配置
      </button>
    </div>

    <div v-if="loading" class="flex justify-center items-center h-40">
      <div class="ant-spin ant-spin-spinning"></div>
    </div>

    <div v-else class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              模型名称
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              API Key
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Base URL
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              状态
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              操作
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="key in llmKeys" :key="key.id">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
              {{ key.modelName }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ key.apiKey ? '******' : '' }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ key.baseUrl }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              <span v-if="key.isDefault" class="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                默认
              </span>
              <span v-else class="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                非默认
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
              <button
                class="text-blue-600 hover:text-blue-900 mr-3"
                @click="handleEdit(key)"
              >
                编辑
              </button>
              <button
                v-if="!key.isDefault"
                class="text-green-600 hover:text-green-900 mr-3"
                @click="handleSetDefault(key.id)"
              >
                设置默认
              </button>
              <button
                class="text-red-600 hover:text-red-900"
                @click="handleDelete(key.id)"
              >
                删除
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="llmKeys.length === 0" class="p-12 text-center text-gray-500">
        暂无大模型配置
      </div>
    </div>

    <!-- 表单弹窗 -->
    <div v-if="formVisible" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
        <h2 class="text-xl font-bold text-gray-800 mb-4">
          {{ formData.id ? '编辑配置' : '添加配置' }}
        </h2>
        <form @submit.prevent="handleSubmit">
          <div class="mb-4 relative" ref="dropdownRef">
            <label class="block text-sm font-medium text-gray-700 mb-1">
              模型名称
            </label>
            <div class="relative">
              <input
                type="text"
                v-model="formData.modelName"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                placeholder="请输入或选择模型名称"
              />
              <button
                type="button"
                @click.stop="showPresetDropdown = !showPresetDropdown"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
            </div>
            <div v-if="showPresetDropdown" class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
              <div
                v-for="model in presetModels"
                :key="model.value"
                @click="selectPresetModel(model)"
                class="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
              >
                <div class="font-medium text-gray-900">{{ model.label }}</div>
                <div class="text-xs text-gray-500">{{ model.value }}</div>
              </div>
            </div>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">
              API Key
            </label>
            <input
              type="text"
              v-model="formData.apiKey"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入 API Key"
            />
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Base URL
            </label>
            <input
              type="text"
              v-model="formData.baseUrl"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入 Base URL"
            />
          </div>
          <div class="mb-4">
            <label class="flex items-center">
              <input
                type="checkbox"
                v-model="formData.isDefault"
                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span class="ml-2 text-sm text-gray-700">设为默认</span>
            </label>
          </div>
          <div class="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              @click="formVisible = false"
            >
              取消
            </button>
            <button
              type="submit"
              class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              :disabled="formLoading"
            >
              <span v-if="formLoading" class="ant-spin ant-spin-spinning"></span>
              <span v-else>{{ formData.id ? '更新' : '保存' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom styles if needed */
</style>
