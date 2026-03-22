<template>
  <Page header-sticky>
    <template #title>
      <div class="flex items-center gap-2">
        <Button type="link" @click="router.back()">
          <template #icon><ArrowLeftOutlined /></template>
        </Button>
        <span class="text-lg font-bold">我的分类</span>
      </div>
    </template>
    
    <div class="p-4 space-y-4">
      <Alert
        v-if="showGuide"
        type="info"
        show-icon
        closable
        @close="handleCloseGuide"
      >
        <template #message>
          <b>欢迎使用分类自定义功能</b>
        </template>
        <template #description>
          <ul class="list-disc pl-4 mt-1">
            <li>您可以自定义分类的名称、颜色和排序。</li>
            <li>如果不使用某些分类，您可以将其隐藏，稍后可以随时恢复。</li>
          </ul>
        </template>
      </Alert>

      <!-- 分类列表区域 -->
      <Card title="我的分类" :bordered="false" class="category-section">
        <template #extra>
          <Button type="primary" @click="handleAddCategory">
            <template #icon><PlusOutlined /></template>
            添加分类
          </Button>
        </template>
        
        <Table
          :data-source="visibleCategories"
          :columns="columns"
          :loading="loading"
          :pagination="false"
          row-key="id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'drag'">
              <HolderOutlined class="drag-handle cursor-move text-gray-400" />
            </template>
            <template v-else-if="column.key === 'name'">
              <span>{{ record.name }}</span>
            </template>
            <template v-else-if="column.key === 'color'">
              <div class="flex items-center justify-center gap-2">
                <div class="h-5 w-5 rounded border" :style="{ backgroundColor: record.color }"></div>
                <span class="font-mono text-xs">{{ record.color }}</span>
              </div>
            </template>
            <template v-else-if="column.key === 'isTrackTime'">
              <Badge :status="record.isTrackTime ? 'processing' : 'default'" :text="record.isTrackTime ? '是' : '否'" />
            </template>
            <template v-else-if="column.key === 'actions'">
              <div class="flex justify-center gap-2">
                <Button type="link" size="small" @click="handleEditClick(record)">
                  <EditOutlined />
                  编辑
                </Button>
                <Popconfirm
                  v-if="record.categoryType === 'public'"
                  title="确定要隐藏此分类吗？您可以随时在下方恢复。"
                  @confirm="handleHide(record)"
                >
                  <Button type="link" size="small" danger>
                    <EyeInvisibleOutlined />
                    隐藏
                  </Button>
                </Popconfirm>
                <Popconfirm
                  v-else
                  title="确定要删除这个分类吗？删除后相关的时间记录将保留但分类信息将丢失。"
                  @confirm="handleDelete(record)"
                >
                  <Button type="link" size="small" danger>
                    <DeleteOutlined />
                    删除
                  </Button>
                </Popconfirm>
              </div>
            </template>
          </template>
        </Table>

        <!-- 已隐藏的分类 -->
        <Collapse v-if="hiddenCategories.length > 0" class="mt-4" :bordered="false">
          <Collapse.Panel key="1" header="已隐藏的分类">
            <div class="flex flex-wrap gap-2">
              <Tag 
                v-for="cat in hiddenCategories" 
                :key="cat.id"
                closable 
                @close="handleUnhide(cat)"
              >
                {{ cat.originalName || cat.name }} (点击恢复)
              </Tag>
            </div>
          </Collapse.Panel>
        </Collapse>
      </Card>
    </div>

    <!-- 分类编辑模态框 -->
    <Modal
      v-model:open="showEditModal"
      :title="modalTitle"
      :confirm-loading="submitLoading"
      @ok="handleSaveCategory"
    >
      <Form
        ref="formRef"
        :model="formState"
        :rules="rules"
        layout="vertical"
        class="mt-4"
      >
        <Form.Item label="分类名称" name="name">
          <Input v-model:value="formState.name" placeholder="请输入分类名称" />
        </Form.Item>

        <Form.Item label="颜色" name="color">
          <div class="flex items-center gap-2">
            <Input
              v-model:value="formState.color"
              placeholder="请输入颜色值（如 #1890ff）"
            />
            <div class="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded border transition-transform hover:scale-110">
              <input
                type="color"
                :value="formState.color"
                class="absolute -inset-1 h-[200%] w-[200%] cursor-pointer opacity-0"
                @input="(e: any) => formState.color = e.target.value"
              />
            </div>
          </div>
          <div class="mt-2 flex flex-wrap gap-2">
            <div
              v-for="color in CATEGORY_COLOR_PRESETS"
              :key="color"
              class="h-6 w-6 cursor-pointer rounded border border-gray-200 transition-transform hover:scale-110"
              :style="{ backgroundColor: color }"
              @click="formState.color = color"
            ></div>
          </div>
        </Form.Item>

        <Form.Item label="追踪时间" name="isTrackTime">
          <Switch
            v-model:checked="formState.isTrackTime"
            :checked-value="1"
            :un-checked-value="0"
          />
        </Form.Item>
      </Form>
    </Modal>
  </Page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { Page } from '@vben/common-ui';
import {
  Alert,
  Badge,
  Button,
  Card,
  Collapse,
  Form,
  Input,
  Modal,
  Popconfirm,
  Switch,
  Table,
  Tag,
  Tooltip,
  message,
} from 'ant-design-vue';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  HolderOutlined,
  InfoCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue';
import { useSortable } from '@vben/hooks';

import {
  deleteCategory,
  listCategories,
  listHiddenCategories,
  reSortCategories,
  saveCategory,
  updateCategory,
} from '#/api/core/time-tracker-category';
import type { TimeTrackerCategoryEntity } from '#/api/core/time-tracker-category';
import { CATEGORY_COLOR_PRESETS } from '../config';
import type { MergedCategory } from '../types';

const router = useRouter();

// 状态
const loading = ref(false);
const categories = ref<TimeTrackerCategoryEntity[]>([]);
const mergedCategories = ref<MergedCategory[]>([]);
const showGuide = ref(localStorage.getItem('time-tracker-category-guide') !== 'false');

// 分类数据计算
const visibleCategories = computed(() => mergedCategories.value.filter(c => !c.isHidden));
const hiddenCategories = computed(() => mergedCategories.value.filter(c => c.isHidden));

// 表格列配置
const columns = [
  { title: '', dataIndex: 'drag', key: 'drag', width: 50, align: 'center' },
  { title: '名称', dataIndex: 'name', key: 'name', width: 150 },
  { title: '颜色', dataIndex: 'color', key: 'color', width: 150, align: 'center' },
  { title: '追踪时间', dataIndex: 'isTrackTime', key: 'isTrackTime', width: 100, align: 'center' },
  { title: '操作', key: 'actions', width: 150, align: 'center' },
];

// 表单相关
const formRef = ref();
const showEditModal = ref(false);
const submitLoading = ref(false);
const editingCategory = ref<TimeTrackerCategoryEntity | null>(null);
const isOverrideMode = ref(false);

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

const modalTitle = computed(() => {
  if (isOverrideMode.value) return '修改默认分类';
  return editingCategory.value ? '编辑自定义分类' : '添加分类';
});

// 方法
const handleCloseGuide = () => {
  localStorage.setItem('time-tracker-category-guide', 'false');
  showGuide.value = false;
};

const fetchCategories = async () => {
  loading.value = true;
  try {
    const [visibleList, hiddenList] = await Promise.all([
      listCategories(),
      listHiddenCategories(),
    ]);
    categories.value = visibleList;

    const merged: MergedCategory[] = [];

    visibleList.forEach(item => {
      const isPublic = Number(item.userId) === 0;
      const isOverride = !!item.templateId;
      merged.push({
        id: item.id as string,
        realId: item.id as string,
        name: item.name,
        color: item.color,
        description: item.description,
        isTrackTime: item.isTrackTime === 1,
        categoryType: isPublic ? 'public' : (isOverride ? 'public' : 'private'),
        isOverridden: isOverride,
        isHidden: false,
        originalId: item.templateId?.toString() || item.id,
        sort: item.sort,
      } as MergedCategory);
    });

    hiddenList.forEach(item => {
      merged.push({
        id: item.id as string,
        realId: item.templateId as string || item.id,
        name: item.name,
        color: item.color,
        description: item.description,
        isTrackTime: item.isTrackTime === 1,
        categoryType: 'public',
        isOverridden: false,
        isHidden: true,
        originalId: item.templateId?.toString() || item.id,
        sort: item.sort,
      } as MergedCategory);
    });

    mergedCategories.value = merged;

  } catch (error) {
    console.error('Failed to fetch categories:', error);
    message.error('获取分类列表失败');
  } finally {
    loading.value = false;
  }
};

const handleAddCategory = () => {
  editingCategory.value = null;
  isOverrideMode.value = false;
  formState.value = {
    name: '',
    color: CATEGORY_COLOR_PRESETS[0] || '#1890ff',
    description: '',
    isTrackTime: 1,
    sort: visibleCategories.value.length * 10,
  };
  showEditModal.value = true;
};

const handleEditClick = (record: MergedCategory) => {
  if (record.categoryType === 'public') {
    handleOverride(record);
  } else {
    handleEdit(record);
  }
};

const handleEdit = (record: MergedCategory) => {
  editingCategory.value = {
    id: record.realId,
    name: record.name,
    color: record.color,
    description: record.description,
    isTrackTime: record.isTrackTime ? 1 : 0,
    sort: record.sort,
  };
  isOverrideMode.value = false;
  formState.value = { ...editingCategory.value };
  showEditModal.value = true;
};

const handleOverride = (record: MergedCategory) => {
  editingCategory.value = {
    id: record.realId, 
    templateId: record.originalId,
    name: record.name,
    color: record.color,
    description: record.description,
    isTrackTime: record.isTrackTime ? 1 : 0,
    sort: record.sort,
  };
  isOverrideMode.value = true;
  formState.value = { ...editingCategory.value };
  showEditModal.value = true;
};

const handleHide = async (record: MergedCategory) => {
  try {
    await updateCategory({
      id: record.realId!,
      isEnabled: 0,
    } as TimeTrackerCategoryEntity);
    message.success('已隐藏');
    fetchCategories();
  } catch (error) {
    message.error('隐藏失败');
  }
};

const handleUnhide = async (record: MergedCategory) => {
  try {
    await updateCategory({
      id: record.realId!,
      templateId: record.originalId,
      isEnabled: 1,
    } as TimeTrackerCategoryEntity);
    message.success('已恢复');
    fetchCategories();
  } catch (error) {
    message.error('恢复失败');
  }
};

const handleDelete = async (record: MergedCategory) => {
  try {
    await deleteCategory(record.realId!);
    message.success('删除成功');
    fetchCategories();
  } catch (error) {
    console.error('Failed to delete category:', error);
    message.error('删除失败');
  }
};

const handleSaveCategory = async () => {
  try {
    await formRef.value.validate();
    submitLoading.value = true;

    if (isOverrideMode.value) {
      // 覆盖默认分类
      const data = {
        ...formState.value,
        id: editingCategory.value?.templateId || editingCategory.value?.id,
      };
      await updateCategory(data);
      message.success('设置已保存');
    } else if (editingCategory.value?.id) {
      // 更新私有分类
      await updateCategory({
        ...formState.value,
        id: editingCategory.value.id,
      });
      message.success('更新成功');
    } else {
      // 新增私有分类
      await saveCategory(formState.value);
      message.success('添加成功');
    }

    showEditModal.value = false;
    fetchCategories();
  } catch (error) {
    console.error('Failed to save category:', error);
  } finally {
    submitLoading.value = false;
  }
};

// 拖拽排序初始化
const initSortable = () => {
  const tables = document.querySelectorAll('.ant-table-tbody');
  
  if (tables.length > 0) {
    const { initializeSortable } = useSortable(tables[0] as HTMLElement, {
      handle: '.drag-handle',
      animation: 150,
      onEnd: async ({ oldIndex, newIndex }: any) => {
        if (oldIndex === newIndex || oldIndex === undefined || newIndex === undefined) return;
        
        const list = [...visibleCategories.value];
        const [movedItem] = list.splice(oldIndex, 1);
        list.splice(newIndex, 0, movedItem!);
        
        const sortData = list.map((item, index) => ({
          id: item.realId,
          templateId: item.originalId,
          sort: index * 10,
        }));
        
        try {
          await reSortCategories(sortData);
          fetchCategories();
        } catch (error) {
          message.error('排序失败');
        }
      },
    });
    initializeSortable();
  }
};

onMounted(() => {
  fetchCategories().then(() => {
    nextTick(() => {
      setTimeout(initSortable, 100);
    });
  });
});
</script>

<style scoped>
.public-category-section :deep(.ant-card-head) {
  border-bottom: 2px solid #1890ff;
}
.private-category-section :deep(.ant-card-head) {
  border-bottom: 2px solid #52c41a;
}
</style>