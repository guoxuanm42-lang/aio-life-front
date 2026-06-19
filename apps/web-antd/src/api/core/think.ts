import { requestClient } from '#/api/request';

export type ThoughtType = 'action' | 'emotion' | 'reflection';

export type ThoughtTypeFilter = 'all' | ThoughtType;

export interface ThoughtActionDetail {
  archiveReason?: string;
  archiveType?: string;
  nextAction?: string;
  reflection?: string;
  restartPolicy?: string;
  resultSummary?: string;
  shelveReason?: string;
  shelveReasonTag?: string;
  valueLevel?: string;
}

export interface ThoughtEmotionDetail {
  copingAction?: string;
  emotionIntensity?: number;
  emotionNeed?: string;
  emotionTrigger?: string;
  emotionType?: string;
  ignoredReason?: string;
  reflectionSummary?: string;
}

export interface ThoughtReflectionDetail {
  archiveType?: string;
  improvementAction?: string;
  lessonType?: string;
  reflectionSummary?: string;
  relatedProject?: string;
  tags?: string;
  valueLevel?: string;
}

export interface ThoughtStatusLog {
  changeReason?: string;
  createTime?: string;
  create_time?: string;
  fromStatus?: string;
  from_status?: string;
  id?: number | string;
  thoughtType?: string | ThoughtType;
  thought_type?: string | ThoughtType;
  toStatus?: string;
  to_status?: string;
}

export interface ThoughtDetail {
  actionDetail?: ThoughtActionDetail | null;
  emotionDetail?: ThoughtEmotionDetail | null;
  events?: any[];
  reflectionDetail?: ThoughtReflectionDetail | null;
  statusLogs?: ThoughtStatusLog[];
  thought?: any;
}

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

export interface ThoughtTypeSummary {
  archivedCount: number;
  backlogCount: number;
  conversionRate: number;
  doneCount: number;
  shelvedCount: number;
  statusDistribution: ThoughtStatisticsDistributionItem[];
  thoughtType: ThoughtType;
  totalCount: number;
  typeName: string;
}

export interface ThoughtStatisticsOverview {
  categoryDistribution: ThoughtStatisticsDistributionItem[];
  statusDistribution: ThoughtStatisticsDistributionItem[];
  summary: ThoughtStatisticsSummary;
  typeSummaries?: ThoughtTypeSummary[];
}

export interface ThoughtStatisticsTrendReq {
  category?: string;
  groupBy?: 'day' | 'month' | 'week';
  range?: '30d' | '7d' | 'month' | 'year';
  status?: string;
  thoughtType?: '' | ThoughtType;
}

export interface ThoughtExportReq {
  status?: string;
  subject?: string;
  themeKey?: string;
  thoughtType?: ThoughtType;
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

export async function detail(id: number | string) {
  return await requestClient.get<ThoughtDetail>(`/thought/${id}/detail`);
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

export async function exportThoughts(params?: ThoughtExportReq) {
  return await requestClient.download<Blob>('/thought/export', {
    params,
  });
}
