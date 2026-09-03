"use client";

import "./desktopPet.css";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from "react";

import { COMPACT_DESKTOP_QUERY } from "../../app/desktopIconInteraction";
import {
  getActiveAiConnection,
  readAiConnectionState,
} from "../../app/aiConnectionStorage";
import {
  buildPetAiMessages,
  NovaAiRequestError,
  requestOpenAiCompletion,
  type NovaAiMessage,
} from "../../app/petAi";
import {
  createLocalPetReply,
  type PetDialogueAction,
} from "../../app/petDialogue";
import {
  createPetConversation,
  createPetConversationTitle,
  deletePetConversation,
  readPetConversationState,
  savePetConversation,
  setActivePetConversation,
  type StoredPetConversation,
  type StoredPetConversationMessage,
} from "../../app/petConversationStorage";
import type { PetMood } from "../../app/petModel";
import { usePetRuntime } from "../platform/pet/PetRuntime";
import { useWindowRuntime } from "../platform/windows/WindowRuntime";
import { useWorkspaceRuntime } from "../platform/workspace/WorkspaceRuntime";

type PetPosition = { x: number; y: number };
type PetPanelSize = { width: number; height: number };
type PetStyle = CSSProperties & {
  "--pet-x": string;
  "--pet-y": string;
  "--pet-wander-x": string;
};

const MOOD_LABELS: Record<PetMood, string> = {
  calm: "平静",
  happy: "开心",
  excited: "兴奋",
  sleepy: "困倦",
  curious: "好奇",
};

const PERSONALITY_LINES = {
  quiet: "我在这里，安静陪你一会儿。",
  curious: "桌面今天会发生什么呢？",
  lively: "准备好一起做点事情了吗？",
} as const;

const QUICK_APPS: readonly (PetDialogueAction & { icon: string })[] = [
  { kind: "open-app", app: "notes", label: "记灵感", icon: "✎" },
  { kind: "open-app", app: "reader", label: "陪我读", icon: "书" },
  { kind: "open-app", app: "focus", label: "陪专注", icon: "◷" },
  { kind: "open-app", app: "games", label: "陪我玩", icon: "✦" },
] as const;

const clamp = (value: number, min: number, max: number) => (
  Math.min(max, Math.max(min, value))
);

export default function DesktopPetLayer({
  maximizedWindow,
  windowOpen,
}: {
  maximizedWindow: boolean;
  windowOpen: boolean;
}) {
  const { data, setHidden, setPosition, resetPosition } = usePetRuntime();
  const { openApp } = useWindowRuntime();
  const { visibleItems } = useWorkspaceRuntime();
  const [panelOpen, setPanelOpen] = useState(false);
  const [draftPosition, setDraftPosition] = useState<PetPosition | null>(null);
  const [wanderX, setWanderX] = useState(0);
  const [introVisible, setIntroVisible] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [compactViewport, setCompactViewport] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [message, setMessage] = useState("");
  const [conversation, setConversation] = useState<StoredPetConversationMessage[]>([]);
  const [storedConversations, setStoredConversations] = useState<StoredPetConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const [conversationReady, setConversationReady] = useState(false);
  const [conversationStorageFailed, setConversationStorageFailed] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [panelSize, setPanelSize] = useState<PetPanelSize>({ width: 400, height: 420 });
  const rootRef = useRef<HTMLDivElement>(null);
  const chatLogRef = useRef<HTMLDivElement>(null);
  const clickTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const messageIdRef = useRef(0);
  const conversationRef = useRef<StoredPetConversationMessage[]>([]);
  const storedConversationsRef = useRef<StoredPetConversation[]>([]);
  const activeConversationIdRef = useRef<string | null>(null);
  const aiSessionIdRef = useRef<string | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    position: PetPosition;
    moved: boolean;
  } | null>(null);
  const panelResizeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    size: PetPanelSize;
    resizeFromLeft: boolean;
    resizeFromTop: boolean;
  } | null>(null);
  const profileId = data?.profile.id;
  const profileCreatedAt = data?.profile.createdAt;

  useEffect(() => {
    const shouldShow = profileCreatedAt !== undefined
      && Date.now() - profileCreatedAt <= 8_000;
    const frame = window.requestAnimationFrame(() => setIntroVisible(shouldShow));
    const timer = shouldShow
      ? window.setTimeout(() => setIntroVisible(false), 5_000)
      : null;
    return () => {
      window.cancelAnimationFrame(frame);
      if (timer) window.clearTimeout(timer);
    };
  }, [profileCreatedAt, profileId]);

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    setConversationReady(false);
    setConversationStorageFailed(false);
    void (async () => {
      const state = await readPetConversationState();
      let conversations = state.conversations;
      let active = conversations.find(({ id }) => id === state.activeConversationId);
      if (!active) {
        active = conversations[0] ?? await createPetConversation();
        if (!conversations.some(({ id }) => id === active?.id)) {
          conversations = [active, ...conversations];
        } else {
          await setActivePetConversation(active.id);
        }
      }
      if (cancelled) return;
      storedConversationsRef.current = conversations;
      activeConversationIdRef.current = active.id;
      conversationRef.current = active.messages;
      messageIdRef.current = Math.max(0, ...active.messages.map(({ id }) => id));
      setStoredConversations(conversations);
      setActiveConversationId(active.id);
      setConversation(active.messages);
      setConversationReady(true);
    })().catch(() => {
      if (cancelled) return;
      setConversationStorageFailed(true);
      setConversationReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  useEffect(() => {
    const media = window.matchMedia(COMPACT_DESKTOP_QUERY);
    const update = () => setCompactViewport(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const compacted = maximizedWindow || (compactViewport && windowOpen);
  const canWander = !!data
    && !data.state.hidden
    && !compacted
    && !reducedMotion
    && data.preferences.motion !== "static";

  useEffect(() => {
    if (!canWander) return;
    const interval = data?.preferences.motion === "active" ? 8_000 : 14_000;
    const wander = () => {
      if (document.visibilityState !== "visible" || dragRef.current) return;
      setWanderX((current) => current === 0 ? (Math.random() > 0.5 ? 18 : -18) : 0);
    };
    const timer = window.setInterval(wander, interval);
    return () => window.clearInterval(timer);
  }, [canWander, data?.preferences.motion, profileId]);

  useEffect(() => () => {
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
  }, []);

  useEffect(() => {
    if (!panelOpen && !introVisible) return;
    const frame = window.requestAnimationFrame(() => {
      const log = chatLogRef.current;
      if (log) log.scrollTop = log.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [conversation.at(-1)?.text, introVisible, panelOpen, thinking]);

  if (!data || !data.preferences.enabled) return null;

  const position = draftPosition ?? data.state;
  const panelBelow = position.y < 0.3;
  const panelOpensBelow = !compacted && panelBelow;
  const panelAlignRight = compacted || position.x >= 0.5;
  const activeConversation = storedConversations.find(
    ({ id }) => id === activeConversationId,
  );
  const style: PetStyle = {
    "--pet-x": `${position.x * 100}%`,
    "--pet-y": `${position.y * 100}%`,
    "--pet-wander-x": `${canWander ? wanderX : 0}px`,
  };

  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (compacted || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      position: { x: data.state.x, y: data.state.y },
      moved: false,
    };
  };

  const movePet = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const bounds = rootRef.current?.getBoundingClientRect();
    if (!drag || drag.pointerId !== event.pointerId || !bounds) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < 4) return;
    drag.moved = true;
    setPanelOpen(false);
    setDraftPosition({
      x: clamp(drag.position.x + deltaX / bounds.width, 0.17, 0.83),
      y: clamp(drag.position.y + deltaY / Math.max(1, bounds.height - 54), 0.1, 0.9),
    });
  };

  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (!drag.moved || !draftPosition) return;
    suppressClickRef.current = true;
    void setPosition(draftPosition.x, draftPosition.y);
    setDraftPosition(null);
  };

  const beginPanelResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panelResizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      size: panelSize,
      resizeFromLeft: panelAlignRight,
      resizeFromTop: !panelOpensBelow,
    };
  };

  const resizePanel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const resize = panelResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    const bounds = rootRef.current?.getBoundingClientRect();
    const deltaX = event.clientX - resize.startX;
    const deltaY = event.clientY - resize.startY;
    setPanelSize({
      width: clamp(
        resize.size.width + (resize.resizeFromLeft ? -deltaX : deltaX),
        320,
        Math.max(320, (bounds?.width ?? window.innerWidth) - 12),
      ),
      height: clamp(
        resize.size.height + (resize.resizeFromTop ? -deltaY : deltaY),
        300,
        Math.max(300, (bounds?.height ?? window.innerHeight) - 110),
      ),
    });
  };

  const endPanelResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (panelResizeRef.current?.pointerId === event.pointerId) {
      panelResizeRef.current = null;
    }
  };

  const togglePanel = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
    clickTimerRef.current = window.setTimeout(() => {
      setPanelOpen((current) => {
        if (current) setSessionMenuOpen(false);
        return !current;
      });
      clickTimerRef.current = null;
    }, 220);
  };

  const playMood = () => {
    if (clickTimerRef.current) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    setPulse((current) => current + 1);
  };

  const runAction = (action: PetDialogueAction) => {
    if (action.kind !== "open-app") return;
    openApp(action.app);
    setPanelOpen(false);
  };

  const showStoredConversation = (stored: StoredPetConversation) => {
    activeConversationIdRef.current = stored.id;
    conversationRef.current = stored.messages;
    messageIdRef.current = Math.max(0, ...stored.messages.map(({ id }) => id));
    aiSessionIdRef.current = null;
    setActiveConversationId(stored.id);
    setConversation(stored.messages);
    setSessionMenuOpen(false);
  };

  const switchConversation = async (stored: StoredPetConversation) => {
    if (thinking || stored.id === activeConversationIdRef.current) {
      setSessionMenuOpen(false);
      return;
    }
    await setActivePetConversation(stored.id);
    showStoredConversation(stored);
  };

  const startNewConversation = async () => {
    if (thinking) return;
    const stored = await createPetConversation();
    const next = [stored, ...storedConversationsRef.current];
    storedConversationsRef.current = next;
    setStoredConversations(next);
    showStoredConversation(stored);
  };

  const removeConversation = async (id: string) => {
    if (thinking) return;
    await deletePetConversation(id);
    const remaining = storedConversationsRef.current.filter((item) => item.id !== id);
    if (id !== activeConversationIdRef.current) {
      storedConversationsRef.current = remaining;
      setStoredConversations(remaining);
      return;
    }
    const nextActive = remaining[0] ?? await createPetConversation();
    const next = remaining.length ? remaining : [nextActive];
    if (remaining.length) await setActivePetConversation(nextActive.id);
    storedConversationsRef.current = next;
    setStoredConversations(next);
    showStoredConversation(nextActive);
  };

  const commitConversation = async (messages: StoredPetConversationMessage[]) => {
    const activeId = activeConversationIdRef.current;
    const current = storedConversationsRef.current.find(({ id }) => id === activeId);
    if (!current) return;
    const firstUserMessage = messages.find(({ role }) => role === "user");
    const updated: StoredPetConversation = {
      ...current,
      title: current.messages.length === 0 && firstUserMessage
        ? createPetConversationTitle(firstUserMessage.text)
        : current.title,
      updatedAt: Date.now(),
      messages,
    };
    const next = [
      updated,
      ...storedConversationsRef.current.filter(({ id }) => id !== updated.id),
    ];
    conversationRef.current = messages;
    storedConversationsRef.current = next;
    setConversation(messages);
    setStoredConversations(next);
    await savePetConversation(updated);
  };

  const sendMessage = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || thinking || !conversationReady || conversationStorageFailed) return;
    const localReply = createLocalPetReply(text, {
      name: data.profile.name,
      personality: data.profile.personality,
      mood: data.state.mood,
      energy: data.state.energy,
    });
    const userMessage: StoredPetConversationMessage = {
      id: ++messageIdRef.current,
      role: "user",
      text,
    };
    await commitConversation([...conversationRef.current, userMessage]);
    setMessage("");
    if (localReply.action) {
      const replyMessage: StoredPetConversationMessage = {
        id: ++messageIdRef.current,
        role: "pet",
        text: localReply.text,
        action: localReply.action,
      };
      await commitConversation([...conversationRef.current, replyMessage]);
      return;
    }

    setThinking(true);
    let pendingReplyId: number | null = null;
    try {
      const aiState = await readAiConnectionState();
      const profile = aiState.settings.enabled
        ? await getActiveAiConnection()
        : null;
      if (!profile) {
        const replyMessage: StoredPetConversationMessage = {
          id: ++messageIdRef.current,
          role: "pet",
          text: localReply.text,
        };
        await commitConversation([...conversationRef.current, replyMessage]);
        return;
      }

      const history: NovaAiMessage[] = conversationRef.current.slice(-7, -1).map((item) => ({
        role: item.role === "pet" ? "assistant" : "user",
        content: item.text,
      }));
      aiSessionIdRef.current ??= `conv-${crypto.randomUUID()}`;
      const replyId = ++messageIdRef.current;
      pendingReplyId = replyId;
      const streamingReply: StoredPetConversationMessage = {
        id: replyId,
        role: "pet",
        text: "…",
      };
      const streamingMessages = [...conversationRef.current, streamingReply];
      conversationRef.current = streamingMessages;
      setConversation(streamingMessages);
      const completion = await requestOpenAiCompletion(
        profile,
        buildPetAiMessages({
          petName: data.profile.name,
          personality: data.profile.personality,
          mood: data.state.mood,
          energy: data.state.energy,
          activitySummary: aiState.settings.contextPermissions.activitySummary
            ? data.memory.eventCounts
            : undefined,
          resourceNames: aiState.settings.contextPermissions.resourceNames
            ? visibleItems.map((item) => item.name)
            : undefined,
        }, history, text),
        {
          maxTokens: 256,
          onUpdate: (content) => {
            const next = streamingMessages.map((item) => item.id === replyId
              ? { ...item, text: content.slice(0, 400) }
              : item);
            conversationRef.current = next;
            setConversation(next);
          },
          sessionId: aiSessionIdRef.current,
        },
      );
      const replyMessage: StoredPetConversationMessage = {
        id: replyId,
        role: "pet",
        text: completion.content.trim().slice(0, 400),
      };
      await commitConversation(streamingMessages.map((item) => (
        item.id === replyId ? replyMessage : item
      )));
    } catch (error) {
      const reason = error instanceof NovaAiRequestError
        ? error.message
        : "AI 对话失败";
      const replyMessage: StoredPetConversationMessage = {
        id: pendingReplyId ?? ++messageIdRef.current,
        role: "pet",
        text: `${reason}。${localReply.text}`,
      };
      const messages = pendingReplyId !== null
        ? conversationRef.current.map((item) => item.id === replyMessage.id ? replyMessage : item)
        : [...conversationRef.current, replyMessage];
      await commitConversation(messages);
    } finally {
      setThinking(false);
    }
  };

  const interactionPanel = (className = "") => <aside
    className={`desktop-pet-panel ${panelAlignRight ? "align-right" : "align-left"} ${conversation.length ? "has-chat" : ""} ${className}`}
    aria-label={`${data.profile.name}的互动面板`}
    style={{ width: panelSize.width, height: conversation.length ? panelSize.height : undefined }}
  >
    <header>
      <div className="pet-panel-identity">
        <span className="pet-panel-avatar" aria-hidden="true"><i/><b/></span>
        <span><strong>{data.profile.name}</strong><small>你的桌面小伙伴</small></span>
      </div>
      <span className={`pet-mood-badge ${thinking ? "thinking" : ""}`}>
        <i/>{thinking ? "正在想…" : MOOD_LABELS[data.state.mood]}
      </span>
    </header>
    <div className="pet-session-bar">
      <button
        type="button"
        className="pet-session-current"
        aria-expanded={sessionMenuOpen}
        disabled={!conversationReady || conversationStorageFailed}
        onClick={() => setSessionMenuOpen((current) => !current)}
      ><span>{activeConversation?.title ?? "正在读取会话"}</span><b>⌄</b></button>
      <button
        type="button"
        className="pet-session-new"
        aria-label="新建对话"
        disabled={!conversationReady || conversationStorageFailed || thinking}
        onClick={() => void startNewConversation()}
      >＋</button>
      {sessionMenuOpen && <div className="pet-session-menu" role="menu" aria-label="本地会话">
        {storedConversations.map((stored) => <div key={stored.id}>
          <button
            type="button"
            role="menuitem"
            aria-current={stored.id === activeConversationId ? "true" : undefined}
            disabled={thinking}
            onClick={() => void switchConversation(stored)}
          ><span>{stored.title}</span><small>{stored.messages.length} 条</small></button>
          <button
            type="button"
            aria-label={`删除会话${stored.title}`}
            disabled={thinking}
            onClick={() => void removeConversation(stored.id)}
          >×</button>
        </div>)}
      </div>}
    </div>
    {conversationStorageFailed && <p className="pet-session-error" role="alert">本地会话读取失败</p>}
    {conversation.length === 0
      ? <div className="pet-chat-welcome">
          <strong>{introVisible ? "初次见面，请多关照呀！" : PERSONALITY_LINES[data.profile.personality]}</strong>
          <span>可以和我聊天，也可以叫我陪你读书、专注或玩游戏。</span>
        </div>
      : <div ref={chatLogRef} className="pet-chat-log" aria-live="polite">
          {conversation.map((item) => {
            const action = item.action;
            return <div key={item.id} className={`pet-chat-message ${item.role}`}>
              <i aria-hidden="true">{item.role === "pet" ? "喵" : "我"}</i>
              <span>{item.text}</span>
              {action && <button onClick={() => runAction(action)}>{action.label}</button>}
            </div>;
          })}
        </div>}
    {conversation.length === 0 && <div className="pet-quick-actions" aria-label="常用操作">
      {QUICK_APPS.map((action) => <button key={action.app} onClick={() => runAction(action)}>
        <i aria-hidden="true">{action.icon}</i><span>{action.label}</span>
      </button>)}
    </div>}
    <form className="pet-chat-input" onSubmit={sendMessage}>
      <span className="pet-chat-field">
        <input
          aria-label={`和${data.profile.name}对话`}
          maxLength={120}
          placeholder={`和${data.profile.name}说点什么…`}
          value={message}
          disabled={thinking || !conversationReady || conversationStorageFailed}
          onChange={(event) => setMessage(event.target.value)}
        />
      </span>
      <button aria-label="发送消息" disabled={thinking || !conversationReady || conversationStorageFailed || !message.trim()} type="submit">{thinking ? "…" : "➤"}</button>
    </form>
    <div className="pet-panel-tools">
      <div className="pet-energy"><span>活力</span><meter min="0" max="100" value={data.state.energy}>{data.state.energy}</meter><b>{data.state.energy}</b></div>
      <footer>
        <button onClick={() => { void resetPosition(); setPanelOpen(false); }}>回窝</button>
        <button onClick={() => { void setHidden(true); setPanelOpen(false); }}>隐藏</button>
      </footer>
    </div>
    {conversation.length > 0 && <button
      type="button"
      className={`pet-panel-resize ${panelOpensBelow ? "from-bottom" : "from-top"} ${panelAlignRight ? "from-left" : "from-right"}`}
      aria-label="调整聊天面板大小"
      onPointerDown={beginPanelResize}
      onPointerMove={resizePanel}
      onPointerUp={endPanelResize}
      onPointerCancel={endPanelResize}
    />}
  </aside>;

  if (data.state.hidden || compacted) {
    return <div className="desktop-pet-layer compact" aria-live="polite">
      {compacted && panelOpen && interactionPanel("compact-panel")}
      <button
        className="desktop-pet-status"
        aria-label={data.state.hidden ? `显示桌面伙伴${data.profile.name}` : `${data.profile.name}当前心情：${MOOD_LABELS[data.state.mood]}`}
        title={data.state.hidden ? "显示桌面伙伴" : `${data.profile.name} · ${MOOD_LABELS[data.state.mood]}`}
        onClick={() => {
          if (data.state.hidden) void setHidden(false);
          else setPanelOpen((current) => !current);
        }}
      >
        <span className={`pet-status-face mood-${data.state.mood}`} aria-hidden="true"><i/><b/></span>
      </button>
    </div>;
  }

  return <div ref={rootRef} className={`desktop-pet-layer ${draftPosition ? "dragging" : ""}`} style={style}>
    <div className={`desktop-pet-anchor motion-${data.preferences.motion}`}>
      {(introVisible || panelOpen) && interactionPanel(panelBelow ? "below" : "")}
      <button
        key={pulse}
        className={`desktop-pet pet-${data.state.activity} mood-${data.state.mood}`}
        aria-label={`${data.profile.name}，${MOOD_LABELS[data.state.mood]}`}
        aria-expanded={panelOpen}
        onClick={togglePanel}
        onDoubleClick={playMood}
        onPointerDown={beginDrag}
        onPointerMove={movePet}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="nova-cat" aria-hidden="true">
          <i className="cat-tail"/>
          <i className="cat-body"/>
          <i className="cat-head">
            <b className="cat-ear left"/>
            <b className="cat-ear right"/>
            <b className="cat-fringe"/>
            <b className="cat-eye left"/>
            <b className="cat-eye right"/>
            <b className="cat-muzzle"/>
          </i>
          <i className="cat-paw left"/>
          <i className="cat-paw right"/>
        </span>
      </button>
    </div>
  </div>;
}
