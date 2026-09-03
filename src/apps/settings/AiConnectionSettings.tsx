"use client";

import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";

import {
  clearAiConnections,
  createAiConnection,
  deleteAiConnection,
  readAiConnectionState,
  setActiveAiConnection,
  updateAiConnection,
  updateAiSettings,
  type NovaAiConnectionSummary,
  type NovaAiSettings,
} from "../../../app/aiConnectionStorage";
import { testActiveAiConnection } from "../../../app/petAi";

type ConnectionForm = {
  id: string | null;
  baseUrl: string;
  model: string;
  apiKey: string;
};

const EMPTY_FORM: ConnectionForm = {
  id: null,
  baseUrl: "",
  model: "",
  apiKey: "",
};

const connectionLabel = (profile: NovaAiConnectionSummary) => {
  try {
    return `${profile.model} · ${new URL(profile.baseUrl).host}`;
  } catch {
    return `${profile.model} · ${profile.baseUrl}`;
  }
};

export default function AiConnectionSettings() {
  const [profiles, setProfiles] = useState<NovaAiConnectionSummary[]>([]);
  const [settings, setSettings] = useState<NovaAiSettings | null>(null);
  const [form, setForm] = useState<ConnectionForm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NovaAiConnectionSummary | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  const refresh = async () => {
    const state = await readAiConnectionState();
    setProfiles(state.profiles);
    setSettings(state.settings);
  };

  useEffect(() => {
    let cancelled = false;
    void readAiConnectionState()
      .then((state) => {
        if (cancelled) return;
        setProfiles(state.profiles);
        setSettings(state.settings);
      })
      .catch(() => {
        if (!cancelled) setMessage("AI 连接配置读取失败");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPortalRoot(sectionRef.current?.closest<HTMLElement>(".settings-app") ?? null);
  }, []);

  const selectConnection = async (id: string | null) => {
    setBusy(true);
    setMessage("");
    try {
      await setActiveAiConnection(id);
      await refresh();
      setMessage(id ? "当前连接已切换" : "当前连接已取消");
    } catch {
      setMessage("当前连接切换失败");
    } finally {
      setBusy(false);
    }
  };

  const saveConnection = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;
    setBusy(true);
    setMessage("");
    try {
      if (form.id) {
        await updateAiConnection(form.id, {
          protocol: "openai-compatible",
          baseUrl: form.baseUrl,
          model: form.model,
          apiKey: form.apiKey || undefined,
        });
        setMessage("连接配置已更新");
      } else {
        await createAiConnection({
          protocol: "openai-compatible",
          baseUrl: form.baseUrl,
          model: form.model,
          apiKey: form.apiKey,
        });
        setMessage("连接配置已保存，请手动选择后使用");
      }
      setForm(null);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "连接配置保存失败");
    } finally {
      setBusy(false);
    }
  };

  const testConnection = async () => {
    setBusy(true);
    setMessage("");
    try {
      await testActiveAiConnection();
      setMessage("连接测试成功");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "连接测试失败");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    setMessage("");
    try {
      await deleteAiConnection(deleteTarget.id);
      setDeleteTarget(null);
      await refresh();
      setMessage("连接配置已删除");
    } catch {
      setMessage("连接配置删除失败");
    } finally {
      setBusy(false);
    }
  };

  const confirmClear = async () => {
    setBusy(true);
    setMessage("");
    try {
      await clearAiConnections();
      setClearOpen(false);
      await refresh();
      setMessage("全部 AI 配置已清除");
    } catch {
      setMessage("AI 配置清除失败");
    } finally {
      setBusy(false);
    }
  };

  const changeSettings = async (
    patch: Partial<Omit<NovaAiSettings, "activeConnectionId">>,
    successMessage?: string,
  ) => {
    if (!settings) return;
    setBusy(true);
    setMessage("");
    try {
      await updateAiSettings(patch);
      await refresh();
      if (successMessage) setMessage(successMessage);
    } catch {
      setMessage("AI 设置保存失败");
    } finally {
      setBusy(false);
    }
  };

  const dialogs = <>
    {form && <div className="settings-restore-layer">
      <form role="dialog" aria-modal="true" className="ai-connection-dialog" aria-label={form.id ? "编辑 AI 连接" : "新增 AI 连接"} onSubmit={(event) => void saveConnection(event)}>
        <strong>{form.id ? "编辑连接" : "新增连接"}</strong>
        <p>保存或切换配置不会发送网络请求。</p>
        <label><span>协议类型</span><select value="openai-compatible" disabled><option value="openai-compatible">OpenAI-compatible</option></select></label>
        <label><span>请求地址</span><input type="url" required value={form.baseUrl} placeholder="https://api.example.com/v1" onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}/></label>
        <label><span>模型 / Endpoint ID</span><input required value={form.model} placeholder="model-name 或 ep-..." onChange={(event) => setForm({ ...form, model: event.target.value })}/></label>
        <label><span>API Key</span><input type="password" required={!form.id} value={form.apiKey} autoComplete="off" placeholder={form.id ? "留空则保留已保存的 Key" : "输入专用 API Key"} onChange={(event) => setForm({ ...form, apiKey: event.target.value })}/></label>
        <small>保存后只在列表中显示 Key 末四位。</small>
        <footer><button type="button" disabled={busy} onClick={() => setForm(null)}>取消</button><button type="submit" className="primary" disabled={busy}>{busy ? "正在保存" : "保存"}</button></footer>
      </form>
    </div>}

    {deleteTarget && <div className="settings-restore-layer">
      <section role="dialog" aria-modal="true" aria-label="确认删除 AI 连接">
        <strong>删除这个连接？</strong>
        <p>{connectionLabel(deleteTarget)}</p>
        <small>{settings?.activeConnectionId === deleteTarget.id ? "删除后当前连接将变为未选择，不会自动切换到其他配置。" : "其他连接和当前选择不受影响。"}</small>
        <footer><button disabled={busy} onClick={() => setDeleteTarget(null)}>取消</button><button className="danger" disabled={busy} onClick={() => void confirmDelete()}>{busy ? "正在删除" : "确认删除"}</button></footer>
      </section>
    </div>}

    {clearOpen && <div className="settings-restore-layer">
      <section role="dialog" aria-modal="true" aria-label="确认清除全部 AI 配置">
        <strong>清除全部 AI 配置？</strong>
        <p>将删除 {profiles.length} 套连接配置、当前选择和上下文权限。</p>
        <small>此操作无法撤销，AI 配置不会包含在 NOVA 备份中。</small>
        <footer><button disabled={busy} onClick={() => setClearOpen(false)}>取消</button><button className="danger" disabled={busy} onClick={() => void confirmClear()}>{busy ? "正在清除" : "确认清除"}</button></footer>
      </section>
    </div>}
  </>;

  return <>
    <section ref={sectionRef} className="settings-section ai-settings" data-settings-section="ai">
      <div className="settings-section-heading">
        <strong>AI 连接</strong>
        <span>连接参数只保存在当前浏览器，不进入 NOVA 备份</span>
      </div>

      <div className="settings-control-list">
        <div className="settings-control-row">
          <span><strong>启用 AI 对话</strong><small>仅在你主动发起对话时使用当前连接</small></span>
          <button
            className="settings-switch"
            role="switch"
            aria-label="启用 AI 对话"
            aria-checked={settings?.enabled ?? false}
            disabled={!settings || busy}
            onClick={() => void changeSettings({ enabled: !settings?.enabled })}
          ><i/><span>{settings?.enabled ? "开启" : "关闭"}</span></button>
        </div>
        <label className="settings-control-row ai-current-connection">
          <span><strong>当前连接</strong><small>地址、模型和 API Key 将整体切换</small></span>
          <select
            aria-label="当前 AI 连接"
            value={settings?.activeConnectionId ?? ""}
            disabled={!settings || busy}
            onChange={(event) => void selectConnection(event.target.value || null)}
          >
            <option value="">未选择</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>{connectionLabel(profile)}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="ai-test-row">
        <span><strong>连接测试</strong><small>发送固定探测文本，不包含宠物记忆或用户内容</small></span>
        <button
          disabled={!settings?.activeConnectionId || busy}
          onClick={() => void testConnection()}
        >{busy ? "请求中" : "测试当前配置"}</button>
      </div>

      <div className="ai-connections-heading">
        <span><strong>连接配置</strong><small>{profiles.length} 套，仅限本机</small></span>
        <button onClick={() => setForm(EMPTY_FORM)}>新增连接</button>
      </div>
      <div className="ai-connection-list">
        {profiles.length ? profiles.map((profile) => (
          <article key={profile.id} className={settings?.activeConnectionId === profile.id ? "active" : ""}>
            <i aria-hidden="true">AI</i>
            <div>
              <strong>{connectionLabel(profile)}</strong>
              <small>{profile.protocol} · Key •••• {profile.apiKeyLastFour}</small>
            </div>
            {settings?.activeConnectionId === profile.id && <span>当前</span>}
            <button
              onClick={() => setForm({
                id: profile.id,
                baseUrl: profile.baseUrl,
                model: profile.model,
                apiKey: "",
              })}
            >编辑</button>
            <button className="danger-text" onClick={() => setDeleteTarget(profile)}>删除</button>
          </article>
        )) : <p>尚未保存连接配置</p>}
      </div>

      <div className="ai-permissions">
        <div className="settings-section-heading ai-permissions-heading">
          <span><strong>上下文权限</strong><small>关闭的内容不会加入后续 AI 请求</small></span>
          <button
            disabled={!settings || busy}
            onClick={() => void changeSettings({
              enabled: true,
              contextPermissions: {
                activitySummary: true,
                resourceNames: true,
                selectedText: true,
              },
            }, "AI 对话和全部上下文权限已开启")}
          >全部允许</button>
        </div>
        {([
          ["activitySummary", "活动摘要", "应用名称与非内容型活动摘要"],
          ["resourceNames", "资源名称", "书名和文件名，默认关闭"],
          ["selectedText", "选中文本", "仅发送当次明确选择的文本"],
        ] as const).map(([key, label, detail]) => (
          <div className="settings-control-row" key={key}>
            <span><strong>{label}</strong><small>{detail}</small></span>
            <button
              className="settings-switch"
              role="switch"
              aria-label={label}
              aria-checked={settings?.contextPermissions[key] ?? false}
              disabled={!settings || busy}
              onClick={() => void changeSettings({
                contextPermissions: {
                  ...settings!.contextPermissions,
                  [key]: !settings!.contextPermissions[key],
                },
              })}
            ><i/><span>{settings?.contextPermissions[key] ? "允许" : "禁止"}</span></button>
          </div>
        ))}
      </div>

      <p className="ai-security-note">
        浏览器本地保存不等同于硬件密钥保护。同源脚本及拥有本机浏览器访问权限的人可能读取 Key，建议使用限额、可撤销的专用 Key。
      </p>

      <div className="settings-reset-panel ai-clear-panel">
        <span><strong>清除全部 AI 配置</strong><small>删除连接参数、当前选择和上下文权限，不影响其他本地数据</small></span>
        <button disabled={!profiles.length || busy} onClick={() => setClearOpen(true)}>清除全部</button>
      </div>
      {message && <p className="settings-data-message" role="status">{message}</p>}
    </section>
    {portalRoot && createPortal(dialogs, portalRoot)}
  </>;
}
