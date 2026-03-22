<template>
  <div class="admin-category-page p-4">
    <a-card title="">
      <template #extra>
        <a-button type="primary" @click="handleAddCategory">
          <PlusOutlined /> 新增公共分类
        </a-button>
      </template>

      <a-table
        :dataSource="publicCategories"
        :columns="columns"
        :pagination="false"
        :loading="loading"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'color'">
            <div class="flex items-center gap-2">
              <div
                class="w-4 h-4 rounded"
                :style="{ backgroundColor: record.color }"
              ></div>
              <span>{{ record.color }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'isTrackTime'">
            <a-tag :color="record.isTrackTime ? 'green' : 'default'">
              {{ record.isTrackTime ? '是' : '否' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" @click="handleEditCategory(record)">
              编辑
            </a-button>
            <a-popconfirm
              title="确定要删除此分类吗？删除后所有用户的覆盖设置将失效，原始分类将消失。"
              @confirm="handleDeleteCategory(record)"
            >
              <a-button type="link" size="small" danger>
                删除
              </a-button>
            </a-popconfirm>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 分类编辑模态框 -->
    <a-modal
      v-model:open="editModalVisible"
      :title="modalTitle"
      @ok="handleSubmitCategory"
      :confirmLoading="submitting"
    >
      <a-form
        ref="formRef"
        :model="formState"
        :rules="rules"
        layout="vertical"
      >
        <a-form-item label="分类名称" name="name">
          <a-input v-model:value="formState.name" placeholder="请输入分类名称" />
        </a-form-item>
        <a-form-item label="颜色" name="color">
          <div class="flex items-center gap-2">
            <a-input v-model:value="formState.color" type="color" class="w-16 h-8 p-0 border-0" />
            <a-input v-model:value="formState.color" class="flex-1" />
          </div>
          <div class="mt-2 flex flex-wrap gap-2">
            <div
              v-for="color in CATEGORY_COLOR_PRESETS"
              :key="color"
              class="w-6 h-6 rounded cursor-pointer border border-gray-200 hover:scale-110 transition-transform"
              :style="{ backgroundColor: color }"
              @click="formState.color = color"
            ></div>
          </div>
        </a-form-item>
        <a-form-item label="描述" name="description">
          <a-textarea v-model:value="formState.description" placeholder="请输入描述" :rows="3" />
        </a-form-item>
        <a-form-item label="追踪时间" name="isTrackTime">
          <a-switch v-model:checked="formState.isTrackTime" :checkedValue="1" :unCheckedValue="0" />
        </a-form-item>
        <a-form-item label="排序" name="sort">
          <a-input-number v-model:value="formState.sort" :min="0" class="w-full" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  Card as ACard,
  Button as AButton,
  Table as ATable,
  Tag as ATag,
  Popconfirm as APopconfirm,
  Modal as AModal,
  Form as AForm,
  FormItem as AFormItem,
  Input as AInput,
  Textarea as ATextarea,
  Switch as ASwitch,
  InputNumber as AInputNumber,
  message,
} from 'ant-design-vue';
import { PlusOutlined } from '@ant-design/icons-vue';
import {
  adminListCategories,
  adminSaveCategory,
  adminUpdateCategory,
  adminDeleteCategory,
} from '#/api/core/time-tracker-category';
import type { TimeTrackerCategoryEntity } from '#/api/core/time-tracker-category';
import { CATEGORY_COLOR_PRESETS } from '../config';

const loading = ref(false);
const submitting = ref(false);
const publicCategories = ref<TimeTrackerCategoryEntity[]>([]);

const columns = [
  { title: '排序', dataIndex: 'sort', key: 'sort', width: 80 },
  { title: '名称', dataIndex: 'name', key: 'name', width: 150 },
  { title: '颜色', dataIndex: 'color', key: 'color', width: 150 },
  {
    title: '追踪时间',
    dataIndex: 'isTrackTime',
    key: 'isTrackTime',
    width: 100,
  },
  { title: '操作', key: 'action', width: 150, fixed: 'right' },
];

const fetchCategories = async () => {
  loading.value = true;
  try {
    const list = await adminListCategories();
    publicCategories.value = list;

  } catch (error) {
    console.error('Failed to fetch categories:', error);
    message.error('获取分类列表失败');
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchCategories();
});

// 表单相关
const editModalVisible = ref(false);
const formRef = ref();
const isEdit = ref(false);

const formState = ref<TimeTrackerCategoryEntity>({
  name: '',
  color: CATEGORY_COLOR_PRESETS[0] || '#1890ff',
  description: '',
  isTrackTime: 1,
  sort: 0,
});

const rules = {
  name: [{ required: true, message: '请输入分类名称' }],
  color: [{ required: true, message: '请选择颜色' }],
};

const modalTitle = computed(() => (isEdit.value ? '编辑公共分类' : '新增公共分类'));

const handleAddCategory = () => {
  isEdit.value = false;
  formState.value = {
    name: '',
    color: CATEGORY_COLOR_PRESETS[0] || '#1890ff',
    description: '',
    isTrackTime: 1,
    sort: publicCategories.value.length * 10, // 默认排在最后
  };
  editModalVisible.value = true;
};

const handleEditCategory = (record: TimeTrackerCategoryEntity) => {
  isEdit.value = true;
  formState.value = { ...record };
  editModalVisible.value = true;
};

const handleDeleteCategory = async (record: TimeTrackerCategoryEntity) => {
  if (!record.id) return;
  try {
    await adminDeleteCategory(record.id);
    message.success('删除成功');
    fetchCategories();
  } catch (error) {
    console.error('Failed to delete category:', error);
    message.error('删除失败');
  }
};

const handleSubmitCategory = async () => {
  try {
    await formRef.value.validate();
    submitting.value = true;

    if (isEdit.value) {
      await adminUpdateCategory(formState.value);
      message.success('更新成功');
    } else {
      await adminSaveCategory(formState.value);
      message.success('新增成功');
    }

    editModalVisible.value = false;
    fetchCategories();
  } catch (error) {
    console.error('Failed to save category:', error);
  } finally {
    submitting.value = false;
  }
};
</script>
