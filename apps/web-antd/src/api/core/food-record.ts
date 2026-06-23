import { requestClient } from '#/api/request';

export interface FoodRecord {
  briefSummary?: string;
  category?: string;
  cookDate?: string;
  cookMinutes?: number;
  createTime?: string;
  difficulty?: string;
  dishName: string;
  id?: string;
  mealType?: string;
  nextImprove?: string;
  nextTrySuggestion?: string;
  prepMinutes?: number;
  problems?: string;
  rating?: number;
  status: FoodRecordStatus;
  successLevel?: string;
  summary?: string;
  tags?: string;
  tasteDescription?: string;
  totalMinutes?: number;
  updateTime?: string;
  worthRedo?: boolean;
}

export interface FoodRecordIngredient {
  id?: string;
  name: string;
  quantity?: string;
  recordId?: string;
  remark?: string;
  sortOrder?: number;
  unit?: string;
}

export interface FoodRecordStep {
  description?: string;
  durationMinutes?: number;
  id?: string;
  recordId?: string;
  sortOrder?: number;
  stepNo?: number;
  title?: string;
}

export interface FoodRecordImage {
  bucketName?: string;
  caption?: string;
  id?: string;
  imageType: FoodRecordImageType;
  objectKey?: string;
  recordId: string;
  sortOrder?: number;
}

export interface FoodRecordDetail {
  images?: FoodRecordImage[];
  ingredients: FoodRecordIngredient[];
  record: FoodRecord;
  steps: FoodRecordStep[];
}

export interface FoodRecordQueryParams {
  category?: string;
  endDate?: string;
  keyword?: string;
  mealType?: string;
  page?: number;
  pageSize?: number;
  startDate?: string;
  status?: FoodRecordStatus | '';
  tags?: string;
}

export interface FoodRecordPage {
  items: FoodRecord[];
  total: number;
}

export interface FoodRecordSavePayload extends FoodRecord {
  ingredients?: FoodRecordIngredient[];
  steps?: FoodRecordStep[];
}

export interface FoodRecipeGenerateRequest {
  currentDraft?: FoodRecordSavePayload;
  instruction?: string;
  prompt: string;
}

export interface FoodRecordImageUpdatePayload {
  caption?: string;
  id: string;
  imageType: FoodRecordImageType;
  sortOrder?: number;
}

export interface FoodRecordImageSortPayload {
  items: Array<{
    id: string;
    sortOrder: number;
  }>;
}

export interface FoodRecordStatisticsOverview {
  averageRating: number;
  averageTotalMinutes: number;
  monthCount: number;
  totalCount: number;
  toImproveCount: number;
  worthRedoCount: number;
}

export interface FoodRecordStatisticsTrendItem {
  count: number;
  label: string;
}

export interface FoodRecordStatisticsNameCount {
  count: number;
  name: string;
}

export interface FoodRecordStatisticsSummary {
  category?: string;
  cookDate?: string;
  dishName: string;
  id: string;
  mealType?: string;
  nextImprove?: string;
  nextTrySuggestion?: string;
  problems?: string;
  rating?: number;
  status?: FoodRecordStatus;
  summary?: string;
  totalMinutes?: number;
  worthRedo?: boolean;
}

export interface FoodRecordStatistics {
  categoryDistribution: FoodRecordStatisticsNameCount[];
  dishRank: FoodRecordStatisticsNameCount[];
  frequencyTrend: FoodRecordStatisticsTrendItem[];
  ingredientRank: FoodRecordStatisticsNameCount[];
  mealTypeDistribution: FoodRecordStatisticsNameCount[];
  overview: FoodRecordStatisticsOverview;
  redoReminders: FoodRecordStatisticsSummary[];
  statusDistribution: FoodRecordStatisticsNameCount[];
  toImproveRecords: FoodRecordStatisticsSummary[];
}

export type FoodRecordImageType =
  | 'failed'
  | 'finished'
  | 'ingredient'
  | 'other'
  | 'process';

export type FoodRecordStatus =
  | 'archived'
  | 'done'
  | 'draft'
  | 'to_improve';

export async function queryFoodRecords(data: FoodRecordQueryParams) {
  return await requestClient.post<FoodRecordPage>('/food-record/query', data);
}

export async function getFoodRecordDetail(id: string) {
  return await requestClient.get<FoodRecordDetail>('/food-record/detail', {
    params: { id },
  });
}

export async function saveFoodRecord(data: FoodRecordSavePayload) {
  return await requestClient.post<FoodRecordDetail>('/food-record/save', data);
}

export async function updateFoodRecord(data: FoodRecordSavePayload) {
  return await requestClient.post<FoodRecordDetail>('/food-record/update', data);
}

export async function deleteFoodRecord(id: string) {
  return await requestClient.post<void>('/food-record/delete', { id });
}

export async function uploadFoodRecordImage(data: FormData) {
  return await requestClient.post<FoodRecordImage>('/food-record/image/upload', data, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}

export async function updateFoodRecordImage(data: FoodRecordImageUpdatePayload) {
  return await requestClient.post<FoodRecordImage>('/food-record/image/update', data);
}

export async function sortFoodRecordImages(data: FoodRecordImageSortPayload) {
  return await requestClient.post<void>('/food-record/image/sort', data);
}

export async function deleteFoodRecordImage(id: string) {
  return await requestClient.post<void>('/food-record/image/delete', { id });
}

export async function getFoodRecordImageBlob(id: string) {
  return await requestClient.download<Blob>('/food-record/image/preview', {
    params: { id },
  });
}

export async function getFoodRecordStatistics() {
  return await requestClient.get<FoodRecordStatistics>('/food-record/statistics');
}

export async function generateFoodRecipeDraft(data: FoodRecipeGenerateRequest) {
  return await requestClient.post<FoodRecordSavePayload>(
    '/food-record/ai/generate-recipe',
    data,
  );
}
