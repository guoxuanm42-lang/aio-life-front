import { requestClient } from '#/api/request';

export interface Article {
  categoryId?: string;
  createTime?: string;
  id?: string;
  markdownContent?: string;
  plainTextContent?: string;
  status: ArticleStatus;
  summary?: string;
  tags?: string;
  title: string;
  updateTime?: string;
  wordCount?: number;
}

export interface ArticlePage {
  items: Article[];
  total: number;
}

export interface ArticleQueryParams {
  categoryId?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
  status?: '' | ArticleStatus;
  tags?: string;
  uncategorized?: boolean;
}

export type ArticleStatus = 'archived' | 'draft' | 'published';

export async function queryArticles(data: ArticleQueryParams) {
  return await requestClient.post<ArticlePage>('/article/query', data);
}

export async function getArticleDetail(id: string) {
  return await requestClient.get<Article>('/article/detail', {
    params: { id },
  });
}

export async function saveArticle(data: Article) {
  return await requestClient.post<Article>('/article/save', data);
}

export async function updateArticle(data: Article) {
  return await requestClient.post<Article>('/article/update', data);
}

export async function deleteArticle(id: string) {
  return await requestClient.post<void>('/article/delete', { id });
}
