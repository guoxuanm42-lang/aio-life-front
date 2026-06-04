import { requestClient } from '#/api/request';

export interface McpJsonSchema {
  additionalProperties?: boolean;
  definitions?: Record<string, any>;
  properties?: Record<string, any>;
  required?: string[];
  type?: string;
}

export interface McpToolItem {
  authRequired: boolean;
  configured: boolean;
  description: string;
  descriptionSource?: 'none' | 'override' | 'runtime' | string;
  displayName: string;
  enabled: boolean;
  groupName: string;
  inputSchema: McpJsonSchema;
  name: string;
  paramCount: number;
  remark?: string;
  runtimeRegistered: boolean;
  sortOrder: number;
  writeOperation: boolean;
}

export interface McpToolCallContent {
  text?: string;
  type?: string;
  [key: string]: any;
}

export interface McpToolCallResult {
  content?: McpToolCallContent[];
  isError?: boolean;
  structuredContent?: any;
  [key: string]: any;
}

export interface McpToolConfigPayload {
  descriptionOverride?: string;
  displayName?: string;
  groupName?: string;
  remark?: string;
  sortOrder?: number;
  writeOperation?: boolean;
}

export interface McpToolCallLogItem {
  argumentsSummary?: string;
  createTime?: string;
  durationMs?: number;
  errorMessage?: string;
  id: number;
  success: boolean;
  toolName: string;
  userId?: number;
}

export async function getMcpToolsApi() {
  return requestClient.get<McpToolItem[]>('/mcp/tools');
}

export async function callMcpToolApi(
  name: string,
  args: Record<string, any>,
) {
  return requestClient.post<McpToolCallResult>(
    `/mcp/tools/${encodeURIComponent(name)}/call`,
    {
      arguments: args,
    },
  );
}

export async function updateMcpToolConfigApi(
  name: string,
  data: McpToolConfigPayload,
) {
  return requestClient.put(`/mcp/tools/${encodeURIComponent(name)}/config`, data);
}

export async function updateMcpToolStatusApi(name: string, enabled: boolean) {
  return requestClient.put(`/mcp/tools/${encodeURIComponent(name)}/status`, {
    enabled,
  });
}

export async function getMcpToolLogsApi(name: string, limit = 50) {
  return requestClient.get<McpToolCallLogItem[]>(
    `/mcp/tools/${encodeURIComponent(name)}/logs`,
    {
      params: { limit },
    },
  );
}
