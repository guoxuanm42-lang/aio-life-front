import type { TimeTrackerConfig, TimeSlotCategory, MergedCategory } from './types';
import type { TimeTrackerCategoryEntity } from '#/api/core/time-tracker-category';

// 默认时间段分类
export const defaultCategories: TimeSlotCategory[] = [];

// 默认配置
export const defaultConfig: TimeTrackerConfig = {
  categories: defaultCategories,
  defaultCategoryId: '',
  minSlotDuration: 15, // 15分钟
  maxSlotDuration: 480, // 8小时
};

// 分类颜色预设
export const CATEGORY_COLOR_PRESETS = [
  '#1890ff', // 蓝色
  '#52c41a', // 绿色
  '#faad14', // 黄色
  '#f5222d', // 红色
  '#722ed1', // 紫色
  '#13c2c2', // 青色
  '#eb2f96', // 粉色
  '#fa8c16', // 橙色
  '#a0d911', // 草绿
  '#2f54eb', // 宝蓝
];

// 判断是否为覆盖记录
export function isOverrideRecord(category: TimeTrackerCategoryEntity): boolean {
  return !!category.templateId;
}

// 判断是否为公共分类
export function isPublicCategory(category: TimeTrackerCategoryEntity): boolean {
  return category.userId === '0' && !category.templateId;
}

// 判断是否为私有分类
export function isPrivateCategory(category: TimeTrackerCategoryEntity): boolean {
  return category.userId !== '0' && !category.templateId;
}

// 获取分类颜色（考虑覆盖）
export function getCategoryColor(categoryId: string, categories: (TimeSlotCategory | MergedCategory)[]): string {
  const category = categories.find(cat => cat.id === categoryId);
  if (!category) return '#d9d9d9';
  
  // 如果有颜色覆盖，使用覆盖后的颜色
  if ('isOverridden' in category && category.isOverridden && (category as MergedCategory).overrideFields?.color) {
    return (category as MergedCategory).overrideFields!.color!;
  }
  return category.color;
}

// 获取分类名称（考虑覆盖）
export function getCategoryName(categoryId: string, categories: (TimeSlotCategory | MergedCategory)[]): string {
  const category = categories.find(cat => cat.id === categoryId);
  if (!category) return '未知';
  
  // 如果有名称覆盖，使用覆盖后的名称
  if ('isOverridden' in category && category.isOverridden && (category as MergedCategory).overrideFields?.name) {
    return (category as MergedCategory).overrideFields!.name!;
  }
  return category.name;
}

// 合并公共分类和用户覆盖记录
export function mergeCategoriesWithOverrides(
  publicCategories: TimeTrackerCategoryEntity[],
  privateCategories: TimeTrackerCategoryEntity[],
  overrideRecords: TimeTrackerCategoryEntity[]
): MergedCategory[] {
  // 1. 构建覆盖 Map: templateId -> overrideRecord
  const overrideMap = new Map<string, TimeTrackerCategoryEntity>();
  overrideRecords.forEach(record => {
    if (record.templateId) {
      overrideMap.set(record.templateId.toString(), record);
    }
  });

  const result: MergedCategory[] = [];

  // 2. 处理公共分类
  publicCategories.forEach(pubCat => {
    const override = overrideMap.get(pubCat.id!);
    
    if (override?.isDeleted === 1) {
      // 公共分类被用户隐藏，生成隐藏标记
      result.push({
        id: pubCat.id!,
        name: pubCat.name,
        color: pubCat.color,
        description: pubCat.description,
        isTrackTime: !!pubCat.isTrackTime,
        categoryType: 'public',
        originalId: pubCat.id!,
        originalName: pubCat.name,
        isOverridden: false,
        isHidden: true,
      });
      return;
    }

    const isOverridden = !!override && override.isDeleted !== 1;
    
    result.push({
      id: pubCat.id!,
      name: override?.name || pubCat.name,
      color: override?.color || pubCat.color,
      description: override?.description || pubCat.description,
      isTrackTime: !!(override?.isTrackTime ?? pubCat.isTrackTime),
      // 注意：这里由于原始分类没有 sort，如果是使用覆盖后的排序，可能需要取 override 的 sort
      categoryType: 'public',
      originalId: pubCat.id!,
      originalName: pubCat.name,
      isOverridden,
      isHidden: false,
      overrideFields: isOverridden ? {
        name: override?.name !== pubCat.name ? override.name : undefined,
        color: override?.color !== pubCat.color ? override.color : undefined,
        sort: override?.sort !== pubCat.sort ? override.sort : undefined,
      } : undefined,
    });
  });

  // 3. 添加私有分类
  privateCategories.forEach(privCat => {
    result.push({
      id: privCat.id!,
      name: privCat.name,
      color: privCat.color,
      description: privCat.description,
      isTrackTime: !!privCat.isTrackTime,
      categoryType: 'private',
      isOverridden: false,
      isHidden: false,
    });
  });

  return result;
}

// 生成覆盖记录
export function generateOverrideRecord(
  publicCategory: TimeTrackerCategoryEntity,
  currentUserId: string,
  changes: Partial<TimeTrackerCategoryEntity>
): TimeTrackerCategoryEntity {
  return {
    userId: currentUserId,
    templateId: publicCategory.id!,
    name: changes.name ?? publicCategory.name,
    color: changes.color ?? publicCategory.color,
    description: changes.description ?? publicCategory.description,
    isTrackTime: changes.isTrackTime ?? publicCategory.isTrackTime,
    sort: changes.sort,
    isDeleted: 0,
  };
}

// 生成隐藏记录
export function generateHideRecord(
  publicCategory: TimeTrackerCategoryEntity,
  currentUserId: string
): TimeTrackerCategoryEntity {
  return {
    userId: currentUserId,
    templateId: publicCategory.id!,
    name: publicCategory.name,
    color: publicCategory.color,
    description: publicCategory.description,
    isTrackTime: publicCategory.isTrackTime,
    isDeleted: 1,
  };
}
