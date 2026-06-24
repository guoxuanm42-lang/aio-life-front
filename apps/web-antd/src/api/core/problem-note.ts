import { requestClient } from '#/api/request';

export interface ProblemNote {
  categoryId?: string;
  createTime?: string;
  difficulty?: string;
  id?: string;
  ideaNote?: string;
  problemContent: string;
  pseudoCode?: string;
  solutionCode?: string;
  status: ProblemNoteStatus;
  tags?: string;
  title: string;
  updateTime?: string;
}

export interface ProblemNotePage {
  items: ProblemNote[];
  total: number;
}

export interface ProblemNoteQueryParams {
  categoryId?: string;
  difficulty?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
  status?: '' | ProblemNoteStatus;
  tags?: string;
  uncategorized?: boolean;
}

export type ProblemNoteStatus =
  | 'archived'
  | 'draft'
  | 'reviewing'
  | 'solved';

export async function queryProblemNotes(data: ProblemNoteQueryParams) {
  return await requestClient.post<ProblemNotePage>('/problem-note/query', data);
}

export async function getProblemNoteDetail(id: string) {
  return await requestClient.get<ProblemNote>('/problem-note/detail', {
    params: { id },
  });
}

export async function saveProblemNote(data: ProblemNote) {
  return await requestClient.post<ProblemNote>('/problem-note/save', data);
}

export async function updateProblemNote(data: ProblemNote) {
  return await requestClient.post<ProblemNote>('/problem-note/update', data);
}

export async function deleteProblemNote(id: string) {
  return await requestClient.post<void>('/problem-note/delete', { id });
}
