import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AI_CONNECTION_DATABASE_NAME,
  createAiConnection,
  readAiConnectionState,
  setActiveAiConnection,
} from "../../app/aiConnectionStorage";
import {
  NovaAiRequestError,
  buildPetAiMessages,
  requestOpenAiCompletion,
  testActiveAiConnection,
} from "../../app/petAi";

const profile = {
  id: "relay",
  protocol: "openai-compatible" as const,
  baseUrl: "https://relay.example.com/v1/chat/completions",
  model: "opensource/example-model",
  apiKey: "test-key-not-secret",
};

afterEach(async () => {
  await deleteDB(AI_CONNECTION_DATABASE_NAME);
});

describe("OpenAI-compatible pet AI adapter", () => {
  it("includes only explicitly supplied conversation context", () => {
    const withoutOptionalContext = buildPetAiMessages({
      petName: "Nova",
      personality: "curious",
      mood: "happy",
      energy: 72,
    }, [], "陪我聊聊");
    const withOptionalContext = buildPetAiMessages({
      petName: "Nova",
      personality: "curious",
      mood: "happy",
      energy: 72,
      activitySummary: { "app-activated": 2 },
      resourceNames: ["本地笔记.txt"],
    }, [], "陪我聊聊");

    expect(withoutOptionalContext[0].content).not.toContain("本地活动摘要");
    expect(withoutOptionalContext[0].content).not.toContain("本地笔记.txt");
    expect(withOptionalContext[0].content).toContain("app-activated:2");
    expect(withOptionalContext[0].content).toContain("本地笔记.txt");
    expect(withOptionalContext.at(-1)).toEqual({
      role: "user",
      content: "陪我聊聊",
    });
  });

  it("matches the relay request contract without adding configuration fields", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response(JSON.stringify({
        choices: [{ message: { content: "OK" } }],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const result = await requestOpenAiCompletion(
      profile,
      [{ role: "user", content: "Hello" }],
      {
        fetcher: fetcher as typeof fetch,
        maxTokens: 1024,
        sessionId: "conv-test",
      },
    );

    expect(result).toEqual({ content: "OK", sessionId: "conv-test" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(profile.baseUrl);
    expect(init).toMatchObject({
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    expect(init?.headers).toEqual({
      Authorization: `Bearer ${profile.apiKey}`,
      "Content-Type": "application/json",
      "x-session-id": "conv-test",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      model: profile.model,
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 1024,
    });
  });

  it("uses the Responses API contract and parses output text for a responses endpoint", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response(JSON.stringify({
        object: "response",
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "我先帮你找找。" }],
          },
          { type: "web_search_call" },
          {
            type: "message",
            content: [{ type: "output_text", text: "陪你读一会儿。" }],
          },
        ],
      }), { status: 200 });
    });
    const responsesProfile = {
      ...profile,
      baseUrl: "https://relay.example.com/api/v3/responses",
      model: "ep-example",
    };
    const messages = [
      { role: "system" as const, content: "你是桌面伙伴。" },
      { role: "assistant" as const, content: "我在这里。" },
      { role: "user" as const, content: "陪我读书" },
    ];

    await expect(requestOpenAiCompletion(
      responsesProfile,
      messages,
      { fetcher: fetcher as typeof fetch, maxTokens: 256 },
    )).resolves.toMatchObject({ content: "陪你读一会儿。" });

    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      model: "ep-example",
      stream: false,
      tools: [{ type: "web_search", max_keyword: 3 }],
      input: [
        { role: "system", content: [{ type: "input_text", text: "你是桌面伙伴。" }] },
        { type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: "我在这里。" }] },
        { role: "user", content: [{ type: "input_text", text: "陪我读书" }] },
      ],
      max_output_tokens: 256,
    });
  });

  it("tests only the active stored profile with fixed probe content", async () => {
    const first = await createAiConnection({
      ...profile,
      apiKey: "first-key",
    });
    await createAiConnection({
      ...profile,
      baseUrl: "https://unused.example.com/v1/chat/completions",
      model: "unused-model",
      apiKey: "unused-key",
    });
    await setActiveAiConnection(first.id);
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response(JSON.stringify({
        choices: [{ message: { content: "OK" } }],
      }), { status: 200 });
    });

    await testActiveAiConnection({
      fetcher: fetcher as typeof fetch,
      sessionId: "conv-probe",
    });

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(profile.baseUrl);
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer first-key",
      "x-session-id": "conv-probe",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      model: profile.model,
      messages: [{ role: "user", content: "Reply with OK only." }],
      max_tokens: 16,
    });
  });

  it("does not retry or switch profiles after a failed request", async () => {
    const active = await createAiConnection({
      ...profile,
      apiKey: "active-key",
    });
    await createAiConnection({
      ...profile,
      baseUrl: "https://fallback.example.com/v1/chat/completions",
      model: "fallback-model",
      apiKey: "fallback-key",
    });
    await setActiveAiConnection(active.id);
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response(null, { status: 503 });
    });

    await expect(testActiveAiConnection({
      fetcher: fetcher as typeof fetch,
      sessionId: "conv-failure",
    })).rejects.toEqual(new NovaAiRequestError("AI 服务返回 HTTP 503"));

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((await readAiConnectionState()).settings.activeConnectionId).toBe(active.id);
  });

  it("reports 401 as an authentication problem without exposing response data", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response(JSON.stringify({ message: "private upstream detail" }), {
        status: 401,
      });
    });

    await expect(requestOpenAiCompletion(
      { ...profile, apiKey: "  active-key  " },
      [{ role: "user", content: "Hello" }],
      { fetcher: fetcher as typeof fetch, sessionId: "conv-auth" },
    )).rejects.toEqual(new NovaAiRequestError(
      "AI 认证失败（HTTP 401），请检查 Key 是否有效且未包含 Bearer 前缀",
    ));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer active-key",
    });
  });

  it("rejects an invalid completion response without retrying", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response(JSON.stringify({ choices: [] }), { status: 200 });
    });

    await expect(requestOpenAiCompletion(
      profile,
      [{ role: "user", content: "Hello" }],
      { fetcher: fetcher as typeof fetch },
    )).rejects.toEqual(new NovaAiRequestError("AI 服务返回格式无效"));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("aborts a timed out request without retrying", async () => {
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        }, { once: true });
      });
    });

    await expect(requestOpenAiCompletion(
      profile,
      [{ role: "user", content: "Hello" }],
      { fetcher: fetcher as typeof fetch, timeoutMs: 0 },
    )).rejects.toEqual(new NovaAiRequestError("AI 请求超时"));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
