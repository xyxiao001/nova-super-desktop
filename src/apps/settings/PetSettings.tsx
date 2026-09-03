"use client";

import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";

import type {
  PetBubbleFrequency,
  PetMotionIntensity,
  PetPersonality,
} from "../../../app/petModel";
import { usePetRuntime } from "../../platform/pet/PetRuntime";

const PERSONALITIES: Array<{ id: PetPersonality; label: string }> = [
  { id: "quiet", label: "安静" },
  { id: "curious", label: "好奇" },
  { id: "lively", label: "活泼" },
];

const MOTION_OPTIONS: Array<{ id: PetMotionIntensity; label: string }> = [
  { id: "static", label: "静态" },
  { id: "gentle", label: "舒缓" },
  { id: "active", label: "活跃" },
];

const BUBBLE_OPTIONS: Array<{ id: PetBubbleFrequency; label: string }> = [
  { id: "low", label: "少" },
  { id: "medium", label: "适中" },
  { id: "high", label: "多" },
];

export default function PetSettings() {
  const {
    data,
    status,
    createPet,
    updateProfile,
    updatePreferences,
    resetPosition,
    resetPet,
  } = usePetRuntime();
  const [name, setName] = useState("Nova");
  const [personality, setPersonality] = useState<PetPersonality>("curious");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [clearOpen, setClearOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setPortalRoot(sectionRef.current?.closest<HTMLElement>(".settings-app") ?? null);
  }, []);

  useEffect(() => {
    if (!data) return;
    setName(data.profile.name);
    setPersonality(data.profile.personality);
  }, [data?.profile.id, data?.profile.name, data?.profile.personality]);

  const submitProfile = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = name.trim();
    if (!normalizedName) return;
    setBusy(true);
    setMessage("");
    try {
      if (data) {
        await updateProfile({ name: normalizedName, personality });
        setMessage("伙伴资料已保存");
      } else {
        await createPet(normalizedName, personality);
        setMessage("桌面伙伴已创建");
      }
    } catch {
      setMessage("桌面伙伴保存失败");
    } finally {
      setBusy(false);
    }
  };

  const changePreferences = async (
    patch: Parameters<typeof updatePreferences>[0],
  ) => {
    setBusy(true);
    setMessage("");
    try {
      await updatePreferences(patch);
    } catch {
      setMessage("伙伴设置保存失败");
    } finally {
      setBusy(false);
    }
  };

  const resetPetPosition = async () => {
    setBusy(true);
    setMessage("");
    try {
      await resetPosition();
      setMessage("伙伴已回到默认位置");
    } catch {
      setMessage("伙伴位置复位失败");
    } finally {
      setBusy(false);
    }
  };

  const confirmReset = async () => {
    setBusy(true);
    setMessage("");
    try {
      await resetPet();
      setClearOpen(false);
      setName("Nova");
      setPersonality("curious");
      setMessage("桌面伙伴已重置");
    } catch {
      setMessage("桌面伙伴重置失败");
    } finally {
      setBusy(false);
    }
  };

  if (status === "loading") {
    return <section ref={sectionRef} className="settings-section pet-settings">
      <div className="settings-section-heading"><strong>桌面伙伴</strong><span>正在读取本地数据</span></div>
    </section>;
  }

  return <>
    <section ref={sectionRef} className="settings-section pet-settings" data-settings-section="pet">
      <div className="settings-section-heading">
        <strong>桌面伙伴</strong>
        <span>只在当前设备生活，不要求联网</span>
      </div>

      <form className="pet-profile-editor" onSubmit={(event) => void submitProfile(event)}>
        <div className="pet-profile-mark" aria-hidden="true"><i/><b/></div>
        <label><span>名字</span><input required maxLength={20} value={name} onChange={(event) => setName(event.target.value)}/></label>
        <fieldset>
          <legend>性格</legend>
          <div className="pet-segmented">
            {PERSONALITIES.map((option) => <button key={option.id} type="button" aria-pressed={personality === option.id} onClick={() => setPersonality(option.id)}>{option.label}</button>)}
          </div>
        </fieldset>
        <button className="pet-profile-save" disabled={busy} type="submit">{data ? "保存资料" : "创建伙伴"}</button>
      </form>

      {data && <>
        <div className="settings-control-list pet-controls">
          <div className="settings-control-row">
            <span><strong>启用桌面伙伴</strong><small>关闭后保留档案和本地记忆</small></span>
            <button className="settings-switch" role="switch" aria-label="启用桌面伙伴" aria-checked={data.preferences.enabled} disabled={busy} onClick={() => void changePreferences({ enabled: !data.preferences.enabled })}><i/><span>{data.preferences.enabled ? "开启" : "关闭"}</span></button>
          </div>
          <div className="settings-control-row pet-option-row">
            <span><strong>动态强度</strong><small>控制闲逛和姿态变化</small></span>
            <div className="pet-segmented">
              {MOTION_OPTIONS.map((option) => <button key={option.id} aria-pressed={data.preferences.motion === option.id} disabled={busy} onClick={() => void changePreferences({ motion: option.id })}>{option.label}</button>)}
            </div>
          </div>
          <div className="settings-control-row">
            <span><strong>宠物声音</strong><small>同时受系统音效总开关控制</small></span>
            <button className="settings-switch" role="switch" aria-label="宠物声音" aria-checked={data.preferences.sound} disabled={busy} onClick={() => void changePreferences({ sound: !data.preferences.sound })}><i/><span>{data.preferences.sound ? "开启" : "关闭"}</span></button>
          </div>
          <div className="settings-control-row pet-option-row">
            <span><strong>气泡频率</strong><small>控制主动反馈出现的频率</small></span>
            <div className="pet-segmented">
              {BUBBLE_OPTIONS.map((option) => <button key={option.id} aria-pressed={data.preferences.bubbleFrequency === option.id} disabled={busy} onClick={() => void changePreferences({ bubbleFrequency: option.id })}>{option.label}</button>)}
            </div>
          </div>
        </div>

        <div className="pet-position-row">
          <span><strong>桌面位置</strong><small>拖动伙伴可以改变它的休息位置</small></span>
          <button disabled={busy} onClick={() => void resetPetPosition()}>回到默认位置</button>
        </div>

        <div className="settings-reset-panel">
          <span><strong>重置桌面伙伴</strong><small>清除当前档案、状态、本地记忆和对话，并重新领养默认伙伴</small></span>
          <button disabled={busy} onClick={() => setClearOpen(true)}>重置伙伴</button>
        </div>
      </>}

      {status === "error" && <p className="settings-data-message error" role="alert">桌面伙伴本地数据读取失败</p>}
      {message && <p className="settings-data-message" role="status">{message}</p>}
    </section>

    {portalRoot && clearOpen && createPortal(
      <div className="settings-restore-layer">
        <section role="dialog" aria-modal="true" aria-label="确认重置桌面伙伴">
          <strong>重置桌面伙伴？</strong>
          <p>将删除 {data?.profile.name} 的档案、状态、位置、本地记忆和对话记录，并重新创建默认伙伴。</p>
          <small>此操作无法撤销，但不会删除 AI 连接配置或其他应用数据。</small>
          <footer><button disabled={busy} onClick={() => setClearOpen(false)}>取消</button><button className="danger" disabled={busy} onClick={() => void confirmReset()}>{busy ? "正在重置" : "确认重置"}</button></footer>
        </section>
      </div>,
      portalRoot,
    )}
  </>;
}
