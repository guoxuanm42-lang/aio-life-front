import { requestClient } from '#/api/request';

export interface ProblemCategory {
  createTime?: string;
  id?: string;
  name: string;
  sortOrder?: number;
  updateTime?: string;
}

export interface ProblemCategoryItem extends ProblemCategory {
  problemCount: number;
}

export interface ProblemCategoryList {
  categories: ProblemCategoryItem[];
  totalCount: number;
  uncategorizedCount: number;
}

export async function getProblemCategoryList() {
  return await requestClient.get<ProblemCategoryList>('/problem-category/list');
}

export async function saveProblemCategory(data: ProblemCategory) {
  return await requestClient.post<ProblemCategory>('/problem-category/save', data);
}

export async function updateProblemCategory(data: ProblemCategory) {
  return await requestClient.post<ProblemCategory>('/problem-category/update', data);
}

export async function deleteProblemCategory(id: string) {
  return await requestClient.post<void>('/problem-category/delete', { id });
}
