import { requestClient } from '#/api/request';

export interface MbtiResult {
  id?: string;
  testId: string;
  mbtiType: string;
  createTime?: string;
  predictions?: string;
  traitOrderConscious?: string;
  traitOrderShadow?: string;
  matches?: string;
  resultsPage?: string;
}

export interface TestInfo {
  testId: string;
  testUrl?: string;
  success: boolean;
  message?: string;
}

export interface CheckResult {
  success: boolean;
  mbtiType?: string;
  predictions?: Record<string, number>;
  traitOrderConscious?: {
    hero?: string;
    parent?: string;
    child?: string;
    inferior?: string;
  };
  traitOrderShadow?: {
    nemesis?: string;
    critic?: string;
    trickster?: string;
    demon?: string;
  };
  matches?: string[];
  resultsPage?: string;
  data?: object;
  message?: string;
}

export async function createMbtiTest() {
  return await requestClient.post<TestInfo>('/mbti/test');
}

export async function checkMbtiResult(testId: string) {
  return await requestClient.get<CheckResult>(`/mbti/test/${testId}`);
}

export async function saveMbtiResult(result: Partial<MbtiResult>) {
  return await requestClient.post<void>('/mbti/result', result);
}

export async function getMbtiHistory() {
  return await requestClient.get<MbtiResult[]>('/mbti/results');
}

export async function getMbtiById(id: string) {
  return await requestClient.get<MbtiResult>(`/mbti/result/${id}`);
}
