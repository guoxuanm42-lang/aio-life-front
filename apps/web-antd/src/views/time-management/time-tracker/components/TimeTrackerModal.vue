<template>
  <Modal
    v-model:open="visible"
    :title="title"
    :width="isMobile ? '95vw' : 600"
    :footer="null"
    @cancel="handleCancel"
  >
    <Spin :spinning="loading">
      <TimeSlotEditForm
        v-if="editingSlot"
        :slot="editingSlot"
        :categories="categories"
        :existing-slots="existingSlots"
        @save="handleSave"
        @delete="handleDelete"
        @cancel="handleCancel"
      />
    </Spin>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Modal, Spin, message } from 'ant-design-vue';
import dayjs from 'dayjs';
import TimeSlotEditForm from './TimeSlotEditForm.vue';
import { defaultConfig } from '../config';
import { generateId, isValidSlot, hasOverlap } from '../utils';
import { recommendNext, save, update, deleteData, getById, query } from '#/api/core/time-tracker';
import { listCategories } from '#/api/core/time-tracker-category';
import type { TimeSlot, TimeSlotFormData } from '../types';

const emit = defineEmits(['success']);

const visible = ref(false);
const loading = ref(false);
const editingSlot = ref<TimeSlot | null>(null);
const existingSlots = ref<TimeSlot[]>([]);
const isMobile = ref(window.innerWidth < 1024);
const categories = ref(defaultConfig.categories);
const isEditMode = ref(false);

// 加载分类配置
const loadCategories = async () => {
  try {
    const data = await listCategories();
    if (data) {
      categories.value = data.map((cat) => {
        const isPublic = Number(cat.userId) === 0;
        const isOverride = !!cat.templateId;
        return {
          id: cat.id as string,
          realId: cat.id as string,
          name: cat.name,
          color: cat.color,
          icon: cat.icon,
          description: cat.description,
          isTrackTime: cat.isTrackTime === 1,
          categoryType: isPublic ? 'public' : (isOverride ? 'public' : 'private'),
          isOverridden: isOverride,
          isHidden: false,
          originalId: cat.templateId?.toString() || cat.id,
          sort: cat.sort,
        };
      }) as any;
    }
  } catch (error) {
    console.error('加载分类配置失败:', error);
  }
};

const title = computed(() => isEditMode.value ? '编辑时间段' : '新增时间段');

const updateIsMobile = () => {
  isMobile.value = window.innerWidth < 1024;
};

onMounted(() => {
  window.addEventListener('resize', updateIsMobile);
  loadCategories();
});

onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile);
});

const open = async (slot?: TimeSlot, date?: string, contextExistingSlots?: TimeSlot[]) => {
  visible.value = true;
  loading.value = true;
  isEditMode.value = !!slot;
  
  const targetDate = slot?.date || date || dayjs().format('YYYY-MM-DD');

  if (contextExistingSlots) {
    existingSlots.value = contextExistingSlots;
  } else {
    try {
      const res = await query({ condition: { date: targetDate } });
      existingSlots.value = Array.isArray(res) ? res : res.items || [];
    } catch (e) {
      console.error('获取已有记录失败:', e);
      existingSlots.value = [];
    }
  }

  if (isEditMode.value && slot) {
    // 编辑模式
    editingSlot.value = { ...slot };
    try {
      const detail = await getById(slot.id);
      if (detail && editingSlot.value && editingSlot.value.id === slot.id) {
        editingSlot.value = {
          ...editingSlot.value,
          ...detail,
          exercises: detail.exercises || []
        };
      }
    } catch (error) {
      console.error('获取详情失败', error);
    } finally {
      loading.value = false;
    }
  } else {
    // 新增模式
    let initialCategoryId = defaultConfig.defaultCategoryId;
    if (categories.value.length > 0 && !categories.value.find(c => c.id === initialCategoryId)) {
      initialCategoryId = categories.value[0]?.id || initialCategoryId;
    }

    const newSlot: TimeSlot = {
      id: generateId(),
      startTime: 0,
      endTime: 30,
      categoryId: initialCategoryId,
      title: '',
      description: '',
      date: targetDate,
      exercises: []
    };
    editingSlot.value = newSlot;

    try {
      const result = await recommendNext({ date: targetDate });
      if (result) {
        const { recommend } = result;
        if (recommend) {
          editingSlot.value = {
            ...newSlot,
            id: recommend.id || newSlot.id,
            startTime: recommend.startTime,
            endTime: recommend.endTime,
            categoryId: recommend.categoryId,
            title: '',
            date: recommend.date || targetDate,
          };
        }
      }
    } catch (e) {
      console.error('Failed to initialize modal:', e);
    } finally {
      loading.value = false;
    }
  }
};

const handleCancel = () => {
  visible.value = false;
  editingSlot.value = null;
};

const handleSave = async (formData: TimeSlotFormData) => {
  const targetDate = editingSlot.value?.date || dayjs().format('YYYY-MM-DD');

  const newSlot: TimeSlot = {
    id: formData.id || generateId(),
    startTime: formData.startTime,
    endTime: formData.endTime,
    categoryId: formData.categoryId,
    title: formData.title,
    description: formData.description || '',
    date: targetDate,
    exercises: formData.exercises,
  };

  // 检查重叠时，只考虑同一天内的时间段，且排除当前正在编辑的记录
  const sameDaySlots = existingSlots.value.filter(s => s.date === targetDate && s.id !== newSlot.id);

  if (isValidSlot(newSlot) && !hasOverlap(sameDaySlots, newSlot)) {
    try {
      loading.value = true;
      if (isEditMode.value) {
        await update(newSlot as any);
        message.success('更新成功');
        visible.value = false;
        emit('success', { action: 'update', slot: newSlot });
      } else {
        await save(newSlot as any);
        message.success('记录成功');
        visible.value = false;
        emit('success', { action: 'add', slot: newSlot });
      }
    } catch(e) {
      console.error(e);
      message.error('保存失败');
    } finally {
      loading.value = false;
    }
  } else {
    message.error('时间段无效或重叠');
  }
};

const handleDelete = async (slotId: string) => {
  try {
    loading.value = true;
    await deleteData({ id: slotId });
    message.success('删除成功');
    visible.value = false;
    emit('success', { action: 'delete', id: slotId });
  } catch (error) {
    console.error('删除失败:', error);
    message.error('删除失败');
  } finally {
    loading.value = false;
  }
};

defineExpose({ open });
</script>
