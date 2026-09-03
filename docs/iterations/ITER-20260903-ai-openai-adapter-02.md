# ITER-20260903：OpenAI-compatible Relay 适配

- 状态：已完成
- 所属 Spec：`docs/specs/SPEC-20260903-desktop-pet-system.md`
- 对应验收项：AC-AI-2、AC-AI-7
- 开始日期：2026-09-03
- 完成日期：2026-09-03

## 本轮目标

让系统当前选中的 AI 配置可以按 OpenAI-compatible Chat Completions 协议执行一次手动连接测试，并适配要求 `x-session-id` 的 relay。

## 本轮不做

- 不把用户提供的真实 API Key、请求地址或模型写入源码；
- 不实现宠物对话界面、上下文组装或长期对话；
- 不自动测试、重试、切换配置或选择备用模型；
- 不启动开发环境，不运行 lint 或完整构建。

## 计划修改

- `app/petAi.ts`：单次 OpenAI-compatible 请求、会话头、超时和响应解析；
- `src/apps/settings/AiConnectionSettings.tsx`：手动测试当前配置；
- `src/apps/settings/settings.css`：测试操作样式；
- `tests/unit/petAi.test.ts`：请求协议和失败行为；
- `docs/specs/SPEC-20260903-desktop-pet-system.md`：记录 relay 请求约定。

## 实现假设

连接配置中的请求地址是完整 Chat Completions 端点，不再拼接路径。测试操作每次从 IndexedDB 读取当前完整配置，并只发送固定探测文本；请求函数只调用一次 `fetch`，因此失败不会产生隐式重试或配置切换。

## 实现—验证记录

### 第 1 轮

- 实现：新增请求适配器和设置页测试入口；
- 验证：协议及失败行为测试通过，TypeScript 发现测试 mock 缺少 Fetch 参数类型；
- 结果：运行逻辑正确，进入第 2 轮修复测试类型。

### 第 2 轮

- 实现：为 mock fetch 补齐 `RequestInfo | URL` 与 `RequestInit` 参数；
- 验证：TypeScript 通过，3 个相关测试文件共 14 项通过；
- 结果：目标完成。

## 验证结果

- [x] `npx tsc --noEmit --incremental false`
- [x] 相关单测：`tests/unit/petAi.test.ts`、`tests/unit/aiConnectionStorage.test.ts`、`tests/unit/appStyles.test.ts`，共 14 项
- [x] mock 请求验证完整端点、Bearer Key、`x-session-id`、模型、消息和 `max_tokens`
- [x] HTTP 失败只请求一次且当前配置不变
- [x] 超时和无效响应均结束当前请求且不重试
- [ ] 未使用真实 Key 发起请求，未执行浏览器 CORS 验收
- [x] 未运行 lint
- [x] 未运行完整构建

## Diff 审计

- [x] 真实 Key 未进入源码、测试、日志或文档
- [x] 没有自动重试、自动切换或备用模型
- [x] 保存和切换配置不会触发请求
- [x] Spec 的其他不修改边界保持不变
- [x] 没有覆盖用户原有修改
- [x] `git diff --check` 通过

## 交付记录

- 完成结果：当前连接可以按 relay 所需协议执行手动测试；
- 用户可感知变化：AI 设置中新增“测试当前配置”按钮和成功/失败状态；
- 未实现能力：宠物对话、上下文预览和 AI 响应到宠物状态的转换；
- 新增或更新 ADR：沿用 `ADR-0007-local-ai-connection-boundary.md`；
- 回写 Spec 的后续事项：记录 `x-session-id` 生命周期与完整端点约定。
