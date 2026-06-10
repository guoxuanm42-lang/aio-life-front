import { requestClient } from '#/api/request';

export interface ThoughtStatisticsSummary {
  archivedCount: number;
  backlogCount: number;
  conversionRate: number;
  doneCount: number;
  highValueCount: number;
  monthNewCount: number;
  pendingCount: number;
  totalCount: number;
  weekNewCount: number;
}

export interface ThoughtStatisticsDistributionItem {
  count: number;
  key: string;
  name: string;
  percent: number;
}

export interface ThoughtStatisticsOverview {
  categoryDistribution: ThoughtStatisticsDistributionItem[];
  statusDistribution: ThoughtStatisticsDistributionItem[];
  summary: ThoughtStatisticsSummary;
}

export interface ThoughtStatisticsTrendReq {
  category?: string;
  groupBy?: 'day' | 'month' | 'week';
  range?: '30d' | '7d' | 'month' | 'year';
  status?: string;
}

export interface ThoughtStatisticsTrendPoint {
  count: number;
  date: string;
}

export interface ThoughtStatisticsCategoryTrend {
  categoryKey: string;
  categoryName: string;
  points: ThoughtStatisticsTrendPoint[];
}

export interface ThoughtStatisticsBurstDay {
  average: number;
  count: number;
  date: string;
}

export interface ThoughtStatisticsTrendOverview {
  activity: ThoughtStatisticsTrendPoint[];
  burstDays: ThoughtStatisticsBurstDay[];
  categoryTrends: ThoughtStatisticsCategoryTrend[];
  groupBy: string;
  range: string;
  trend: ThoughtStatisticsTrendPoint[];
}

export async function query(data: any) {
  return await requestClient.post('/thought/query', data);
}

export async function save(data: any) {
  return await requestClient.post('/thought/save', data);
}

export async function update(data: any) {
  return await requestClient.post('/thought/update', data);
}

export async function deleteData(data: any) {
  return await requestClient.post('/thought/batchDelete', data);
}

export async function getThoughtStatisticsOverview() {
  return await requestClient.get<ThoughtStatisticsOverview>('/thought/statistics/overview');
}

export async function getThoughtStatisticsTrend(params?: ThoughtStatisticsTrendReq) {
  return await requestClient.get<ThoughtStatisticsTrendOverview>(
    '/thought/statistics/trend',
    { params },
  );
}
