import { requestClient } from '#/api/request';

export interface ArticleCategory {
  createTime?: string;
  id?: string;
  name: string;
  sortOrder?: number;
  updateTime?: string;
}

export interface ArticleCategoryItem extends ArticleCategory {
  articleCount: number;
}

export interface ArticleCategoryList {
  categories: ArticleCategoryItem[];
  totalCount: number;
  uncategorizedCount: number;
}

export async function getArticleCategoryList() {
  return await requestClient.get<ArticleCategoryList>('/article-category/list');
}

export async function saveArticleCategory(data: ArticleCategory) {
  return await requestClient.post<ArticleCategory>('/article-category/save', data);
}

export async function updateArticleCategory(data: ArticleCategory) {
  return await requestClient.post<ArticleCategory>('/article-category/update', data);
}

export async function deleteArticleCategory(id: string) {
  return await requestClient.post<void>('/article-category/delete', { id });
}
