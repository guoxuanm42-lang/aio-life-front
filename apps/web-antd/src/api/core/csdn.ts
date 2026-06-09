import { requestClient } from '#/api/request';

export interface CsdnStats {
  commentCount: number;
  fansCount: number;
  likeCount: number;
  originalCount: number;
  rank: number;
  viewCount: number;
}

export interface CsdnArticle {
  collectCount: number;
  commentCount: number;
  description: string;
  id: string;
  likeCount: number;
  postTime: string;
  title: string;
  url: string;
  viewCount: number;
}

const apiPrefix = (import.meta.env.VITE_GLOB_API_URL || '/api').replace(
  /\/$/,
  '',
);

function apiPath(path: string) {
  return `${apiPrefix}${path}`;
}

export async function getCsdnStatsApi(username: string) {
  return requestClient.get<CsdnStats>(apiPath('/csdn/stats'), {
    baseURL: '',
    params: { username },
  });
}

export async function getCsdnArticlesApi(username: string, limit = 20) {
  return requestClient.get<CsdnArticle[]>(apiPath('/csdn/articles'), {
    baseURL: '',
    params: { limit, username },
  });
}
