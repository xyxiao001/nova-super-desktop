import {
  getActiveAiConnection,
  type NovaAiConnectionProfile,
} from "./aiConnectionStorage";

export type NovaAiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type NovaAiCompletion = {
  content: string;
  sessionId: string;
};

export type NovaAiRequestOptions = {
  fetcher?: typeof fetch;
  maxTokens?: number;
  onUpdate?: (content: string) => void;
  sessionId?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type PetAiConversationContext = {
  petName: string;
  personality: string;
  mood: string;
  energy: number;
  activitySummary?: Partial<Record<string, number>>;
  resourceNames?: string[];
};

type OpenAiCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
};

type OpenAiResponsesResponse = {
  output?: Array<{
    type?: unknown;
    content?: Array<{
      type?: unknown;
      text?: unknown;
    }>;
  }>;
};

type OpenAiStreamEvent = {
  type?: unknown;
  delta?: unknown;
  choices?: Array<{
    delta?: {
      content?: unknown;
    };
  }>;
};

const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TIMEOUT_MS = 20_000;
const CONNECTION_TEST_MESSAGE = "Reply with OK only.";

export class NovaAiRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NovaAiRequestError";
  }
}

const createSessionId = () => `conv-${crypto.randomUUID()}`;

export const buildPetAiMessages = (
  context: PetAiConversationContext,
  history: readonly NovaAiMessage[],
  userMessage: string,
): NovaAiMessage[] => {
  const contextLines = [
    `你是 NOVA 桌面伙伴，名字是${context.petName}，性格是${context.personality}。`,
    `当前心情是${context.mood}，精力为${context.energy}/100。`,
    "请用自然、简短的中文回复，最多 120 字，不使用 Markdown，不声称已经执行任何系统操作。",
  ];
  const activitySummary = Object.entries(context.activitySummary ?? {})
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([type, count]) => `${type}:${count}`)
    .join("，");
  if (activitySummary) contextLines.push(`本地活动摘要：${activitySummary}`);
  const resourceNames = context.resourceNames?.filter(Boolean).slice(0, 12);
  if (resourceNames?.length) {
    contextLines.push(`当前桌面资源名称：${resourceNames.join("，")}`);
  }
  return [
    { role: "system", content: contextLines.join("\n") },
    ...history.slice(-6),
    { role: "user", content: userMessage.slice(0, 120) },
  ];
};

const responseErrorMessage = (status: number) => {
  if (status === 401) {
    return "AI 认证失败（HTTP 401），请检查 Key 是否有效且未包含 Bearer 前缀";
  }
  if (status === 403) return "AI 服务拒绝访问（HTTP 403）";
  if (status === 404) return "AI 模型或 Endpoint ID 不可用（HTTP 404）";
  if (status === 429) return "AI 请求过于频繁（HTTP 429）";
  return `AI 服务返回 HTTP ${status}`;
};

const usesResponsesApi = (baseUrl: string) => (
  new URL(baseUrl).pathname.replace(/\/+$/, "").endsWith("/responses")
);

const readStreamingContent = async (
  response: Response,
  responsesApi: boolean,
  onUpdate: (content: string) => void,
) => {
  if (!response.body) throw new NovaAiRequestError("AI 服务未返回流式内容");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  const processLine = (line: string) => {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return;
    let event: OpenAiStreamEvent;
    try {
      event = JSON.parse(data) as OpenAiStreamEvent;
    } catch {
      throw new NovaAiRequestError("AI 服务返回了无效流式数据");
    }
    const delta = responsesApi
      ? (event.type === "response.output_text.delta" ? event.delta : undefined)
      : event.choices?.[0]?.delta?.content;
    if (typeof delta !== "string" || !delta) return;
    content += delta;
    onUpdate(content);
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = done ? "" : (lines.pop() ?? "");
    lines.forEach(processLine);
    if (done) break;
  }
  if (buffer) processLine(buffer);
  return content;
};

export async function requestOpenAiCompletion(
  profile: NovaAiConnectionProfile,
  messages: readonly NovaAiMessage[],
  options: NovaAiRequestOptions = {},
): Promise<NovaAiCompletion> {
  const fetcher = options.fetcher ?? fetch;
  const sessionId = options.sessionId ?? createSessionId();
  const controller = new AbortController();
  let timedOut = false;
  const abortRequest = () => controller.abort();
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener("abort", abortRequest, { once: true });

  try {
    const responsesApi = usesResponsesApi(profile.baseUrl);
    const streaming = !!options.onUpdate;
    const response = await fetcher(profile.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${profile.apiKey.trim()}`,
        "Content-Type": "application/json",
        "x-session-id": sessionId,
      },
      body: JSON.stringify(responsesApi
          ? {
            model: profile.model,
            stream: streaming,
            tools: [{ type: "web_search", max_keyword: 3 }],
            input: messages.map((message) => message.role === "assistant"
              ? {
                  type: "message",
                  role: "assistant",
                  status: "completed",
                  content: [{ type: "output_text", text: message.content }],
                }
              : {
                  role: message.role,
                  content: [{ type: "input_text", text: message.content }],
                }),
            max_output_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
          }
        : {
            model: profile.model,
            messages,
            max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
            ...(streaming ? { stream: true } : {}),
          }),
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new NovaAiRequestError(responseErrorMessage(response.status));
    }

    if (options.onUpdate) {
      const content = await readStreamingContent(response, responsesApi, options.onUpdate);
      if (!content.trim()) throw new NovaAiRequestError("AI 服务返回格式无效");
      return { content, sessionId };
    }

    let payload: OpenAiCompletionResponse | OpenAiResponsesResponse;
    try {
      payload = await response.json() as OpenAiCompletionResponse;
    } catch {
      throw new NovaAiRequestError("AI 服务返回了无效 JSON");
    }
    const content = responsesApi
      ? (payload as OpenAiResponsesResponse).output
          ?.filter((item) => item.type === "message")
          .flatMap((item) => item.content ?? [])
          .filter((item) => item.type === "output_text")
          .at(-1)?.text
      : (payload as OpenAiCompletionResponse).choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new NovaAiRequestError("AI 服务返回格式无效");
    }
    return { content, sessionId };
  } catch (error) {
    if (error instanceof NovaAiRequestError) throw error;
    if (controller.signal.aborted) {
      throw new NovaAiRequestError(timedOut ? "AI 请求超时" : "AI 请求已取消");
    }
    throw new NovaAiRequestError("无法连接 AI 服务");
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortRequest);
  }
}

export async function testActiveAiConnection(
  options: Omit<NovaAiRequestOptions, "maxTokens"> = {},
): Promise<void> {
  const profile = await getActiveAiConnection();
  if (!profile) throw new NovaAiRequestError("请先选择当前连接");
  await requestOpenAiCompletion(
    profile,
    [{ role: "user", content: CONNECTION_TEST_MESSAGE }],
    { ...options, maxTokens: 16 },
  );
}
