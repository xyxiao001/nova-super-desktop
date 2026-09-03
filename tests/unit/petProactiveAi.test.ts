import { describe, expect, it, vi } from "vitest";

import {
  PROACTIVE_AI_COOLDOWN_MS,
  PROACTIVE_AI_MAX_REQUESTS_PER_SESSION,
  PROACTIVE_AI_MAX_TOKENS,
  buildPetProactiveAiMessages,
  canRequestProactiveAi,
  normalizePetProactiveAiLine,
  requestPetProactiveAiLine,
} from "../../app/petProactiveAi";

const context = {
  petName: "Nova",
  personality: "curious" as const,
  mood: "calm" as const,
  activity: "bathe" as const,
};

const profile = {
  id: "proactive",
  protocol: "openai-compatible" as const,
  baseUrl: "https://relay.example.com/v1/responses",
  model: "example-model",
  apiKey: "test-key",
};

describe("proactive pet AI", () => {
  it("enforces a long cooldown and a hard per-session request limit", () => {
    expect(canRequestProactiveAi({
      requestCount: 0,
      lastRequestAt: null,
      now: 1,
    })).toBe(true);
    expect(canRequestProactiveAi({
      requestCount: 1,
      lastRequestAt: 1_000,
      now: 1_000 + PROACTIVE_AI_COOLDOWN_MS - 1,
    })).toBe(false);
    expect(canRequestProactiveAi({
      requestCount: PROACTIVE_AI_MAX_REQUESTS_PER_SESSION,
      lastRequestAt: null,
      now: 1,
    })).toBe(false);
  });

  it("builds a short prompt without conversations or resource content", () => {
    const messages = buildPetProactiveAiMessages(context);

    expect(messages).toHaveLength(2);
    expect(messages[0].content).toContain("8到24个汉字");
    expect(messages[0].content).toContain("泡澡");
    expect(messages.map(({ content }) => content).join("")).not.toContain("文件名");
    expect(messages.map(({ content }) => content).join("")).not.toContain("历史对话");
  });

  it("caps the displayed result to a single short line", () => {
    expect(normalizePetProactiveAiLine("  今天\n也慢慢来。  ")).toBe("今天 也慢慢来。");
    expect(normalizePetProactiveAiLine("很".repeat(80))).toHaveLength(48);
  });

  it("uses the small token budget without enabling web search", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response(JSON.stringify({
        output: [{
          type: "message",
          content: [{ type: "output_text", text: "泡泡很软，今天也慢慢来。" }],
        }],
      }), { status: 200 });
    });

    await expect(requestPetProactiveAiLine(
      profile,
      context,
      { fetcher: fetcher as typeof fetch },
    )).resolves.toBe("泡泡很软，今天也慢慢来。");

    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(body.max_output_tokens).toBe(PROACTIVE_AI_MAX_TOKENS);
    expect(body).not.toHaveProperty("tools");
    expect(body.input).toHaveLength(2);
  });
});
