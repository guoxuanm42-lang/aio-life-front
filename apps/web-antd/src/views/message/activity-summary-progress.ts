import type {
  ActivitySummaryGenerateResponse,
  ActivitySummaryPeriod,
  ActivitySummaryProgressEvent,
  ActivitySummaryProgressStage,
} from '#/api/core/llm';

export type ActivitySummaryTraceStatus =
  | 'completed'
  | 'disconnected'
  | 'empty'
  | 'failed'
  | 'running';

export type ActivitySummaryBusinessStage = Exclude<
  ActivitySummaryProgressStage,
  'COMPLETED'
>;

export interface ActivitySummaryStageTiming {
  completedAt?: number;
  label: string;
  percent: number;
  stage: ActivitySummaryBusinessStage;
  startedAt: number;
}

export interface ActivitySummaryProgressTrace {
  assistantMessageId?: string;
  collapsed: boolean;
  completedAt?: number;
  conversationId: string;
  errorMessage?: string;
  idempotencyKey: string;
  label: string;
  percent: number;
  period: ActivitySummaryPeriod;
  retryable?: boolean;
  stage?: ActivitySummaryProgressStage;
  stages: ActivitySummaryStageTiming[];
  startedAt: number;
  status: ActivitySummaryTraceStatus;
}

const STORAGE_PREFIX = 'aio-life:activity-summary-progress:v1';
const MAX_STORED_TRACES = 50;

const storageKey = (userId: string) => `${STORAGE_PREFIX}:${userId}`;

export const createActivitySummaryTrace = (input: {
  conversationId: string;
  idempotencyKey: string;
  period: ActivitySummaryPeriod;
  startedAt?: number;
}): ActivitySummaryProgressTrace => ({
  collapsed: false,
  conversationId: input.conversationId,
  idempotencyKey: input.idempotencyKey,
  label: '正在连接生成服务',
  percent: 0,
  period: input.period,
  stages: [],
  startedAt: input.startedAt ?? Date.now(),
  status: 'running',
});

const completePreviousStage = (
  stages: ActivitySummaryStageTiming[],
  completedAt: number,
) =>
  stages.map((stage, index) =>
    index === stages.length - 1 && stage.completedAt === undefined
      ? { ...stage, completedAt }
      : stage,
  );

export const applyActivitySummaryProgress = (
  trace: ActivitySummaryProgressTrace,
  progress: ActivitySummaryProgressEvent,
  receivedAt = Date.now(),
): ActivitySummaryProgressTrace => {
  if (progress.stage === 'COMPLETED') {
    return {
      ...trace,
      label: progress.label,
      percent: progress.percent,
      stage: progress.stage,
      stages: completePreviousStage(trace.stages, receivedAt),
    };
  }

  const stageChanged = trace.stage !== progress.stage;
  const stages = stageChanged
    ? [
        ...completePreviousStage(trace.stages, receivedAt),
        {
          label: progress.label,
          percent: progress.percent,
          stage: progress.stage,
          startedAt: receivedAt,
        },
      ]
    : trace.stages.map((stage, index) =>
        index === trace.stages.length - 1
          ? { ...stage, label: progress.label, percent: progress.percent }
          : stage,
      );

  return {
    ...trace,
    label: progress.label,
    percent: progress.percent,
    stage: progress.stage,
    stages,
    status: 'running',
  };
};

export const completeActivitySummaryTrace = (
  trace: ActivitySummaryProgressTrace,
  result: ActivitySummaryGenerateResponse,
  completedAt = Date.now(),
): ActivitySummaryProgressTrace => {
  const hasReport = Boolean(result.userMessageId && result.assistantMessageId);
  return {
    ...trace,
    assistantMessageId: result.assistantMessageId,
    collapsed: true,
    completedAt,
    label: hasReport ? '报告已生成' : '当前周期无可总结数据',
    percent: 100,
    stage: 'COMPLETED',
    stages: completePreviousStage(trace.stages, completedAt),
    status: hasReport ? 'completed' : 'empty',
  };
};

export const terminateActivitySummaryTrace = (
  trace: ActivitySummaryProgressTrace,
  input: {
    errorMessage?: string;
    retryable?: boolean;
    status: 'disconnected' | 'failed';
  },
  completedAt = Date.now(),
): ActivitySummaryProgressTrace => ({
  ...trace,
  collapsed: false,
  completedAt,
  errorMessage: input.errorMessage,
  retryable: input.retryable,
  status: input.status,
});

export const restoreActivitySummaryTraces = (
  userId: string,
  storage: Storage = window.sessionStorage,
): ActivitySummaryProgressTrace[] => {
  if (!userId) return [];
  try {
    const rawValue = storage.getItem(storageKey(userId));
    if (!rawValue) return [];
    const parsed = JSON.parse(rawValue) as ActivitySummaryProgressTrace[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (trace) =>
          trace &&
          typeof trace.conversationId === 'string' &&
          typeof trace.idempotencyKey === 'string' &&
          typeof trace.startedAt === 'number',
      )
      .map((trace) =>
        trace.status === 'running'
          ? terminateActivitySummaryTrace(
              trace,
              {
                errorMessage: '页面已刷新，报告可能仍在后台继续生成。',
                status: 'disconnected',
              },
              Date.now(),
            )
          : trace,
      );
  } catch {
    return [];
  }
};

export const persistActivitySummaryTraces = (
  userId: string,
  traces: ActivitySummaryProgressTrace[],
  storage: Storage = window.sessionStorage,
) => {
  if (!userId) return;
  try {
    const retained = [...traces]
      .sort((left, right) => left.startedAt - right.startedAt)
      .slice(-MAX_STORED_TRACES);
    storage.setItem(storageKey(userId), JSON.stringify(retained));
  } catch {
    // Progress persistence is best-effort and must not interrupt generation.
  }
};

export const removeConversationSummaryTraces = (
  traces: ActivitySummaryProgressTrace[],
  conversationId: string,
) => traces.filter((trace) => trace.conversationId !== conversationId);
