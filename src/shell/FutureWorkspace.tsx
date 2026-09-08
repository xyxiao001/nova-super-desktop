import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { APP_REGISTRY, LAUNCHER_APPS, START_APP_GROUPS, type WindowAppId } from "../platform/apps/appRegistry";
import { allWindowInstances, type WindowInstanceId, type WindowInstanceMap } from "../platform/windows/windowInstanceState";

function trackCardLight(event: ReactPointerEvent<HTMLElement>) {
  const card = event.currentTarget;
  const rect = card.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  card.style.setProperty("--card-light-x", `${x * 100}%`);
  card.style.setProperty("--card-light-y", `${y * 100}%`);
  card.style.setProperty("--card-tilt-x", `${(0.5 - y) * 5}deg`);
  card.style.setProperty("--card-tilt-y", `${(x - 0.5) * 5}deg`);
}

export type FutureWorkspaceView = "apps" | "files" | "windows";

export type FutureWorkspaceProps = {
  view: FutureWorkspaceView;
  overview: boolean;
  instances: WindowInstanceMap;
  focused: "desktop" | WindowInstanceId;
  onViewChange: (view: FutureWorkspaceView) => void;
  onDismiss: () => void;
  onSearch: () => void;
  onLaunch: (app: WindowAppId) => void;
  onFocus: (id: WindowInstanceId) => void;
  onMinimize: (id: WindowInstanceId) => void;
  onClose: (id: WindowInstanceId) => void;
  onPair: (left: WindowInstanceId, right: WindowInstanceId) => void;
};

export default function FutureWorkspace({ view, overview, instances, focused, onViewChange, onDismiss, onSearch, onLaunch, onFocus, onMinimize, onClose, onPair }: FutureWorkspaceProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [pairId, setPairId] = useState<WindowInstanceId | null>(null);
  const windows = allWindowInstances(instances).sort((a, b) => b.z - a.z);
  const pairWindow = windows.find((instance) => instance.id === pairId);
  const changeView = (next: FutureWorkspaceView) => { setPairId(null); onViewChange(next); };
  const resume = (id: WindowInstanceId) => { setPairId(null); onFocus(id); };
  const dismiss = () => { setPairId(null); onDismiss(); };
  useEffect(() => { setPairId(null); if (overview) closeRef.current?.focus(); }, [overview]);

  return <section className={`future-workspace ${overview ? "is-overview" : ""}`} data-view={view} aria-label="未来工作空间" onKeyDown={(event) => {
    if (event.key === "Escape" && pairWindow) { event.stopPropagation(); setPairId(null); }
    else if (overview && event.key === "Escape") { event.stopPropagation(); dismiss(); }
  }}>
    <header className="future-workspace-toolbar">
      <span className="future-workspace-brand" aria-hidden="true">◎</span>
      <nav aria-label="空间视图">
        <button aria-pressed={view === "apps"} onClick={() => changeView("apps")}>应用空间</button>
        <button aria-pressed={view === "files"} onClick={() => changeView("files")}>文件桌面</button>
        <button aria-pressed={view === "windows"} onClick={() => changeView("windows")}>运行窗口 <span>{windows.length}</span></button>
      </nav>
      <button className="future-workspace-search" onClick={onSearch}><span aria-hidden="true">⌕</span> 搜索</button>
      {overview && <button ref={closeRef} className="future-workspace-dismiss" aria-label="退出空间总览" onClick={dismiss}>×</button>}
    </header>
    {view === "files" && windows.length > 0 && <button className="future-resume-work" onClick={() => resume(windows[0].id)}><span aria-hidden="true">↗</span><span><strong>继续最近窗口</strong><small>{windows[0].taskbarTitle ?? windows[0].title ?? APP_REGISTRY[windows[0].app].label}</small></span></button>}
    {view === "apps" && <div key="apps" className="future-workspace-body">
      {START_APP_GROUPS.map((group) => <section className="future-app-group" key={group.id} aria-label={group.label}>
        <h2>{group.label}</h2>
        <div className="future-app-grid">{LAUNCHER_APPS.filter((app) => app.startGroup === group.id).map((app) => {
          const count = windows.filter((instance) => instance.app === app.id).length;
          return <button className="future-app-card" key={app.id} onPointerMove={trackCardLight} onClick={() => count > 1 ? changeView("windows") : onLaunch(app.id)}>
            <i className={`shortcut-icon ${app.kind}-shortcut`} aria-hidden="true">{app.icon}</i>
            <span><strong>{app.label}</strong><small>{count > 1 ? `${count} 个窗口 · 选择窗口` : count === 1 ? "1 个窗口 · 继续" : "打开应用"}</small></span>
            <b aria-hidden="true">↗</b>
          </button>;
        })}</div>
      </section>)}
    </div>}
    {view === "windows" && <div key="windows" className="future-workspace-body">
      <div className="future-window-heading"><h2>运行窗口</h2><span>选择一个窗口，继续刚才的工作</span></div>
      {pairWindow && <div className="future-pair-prompt" role="status"><span className="future-pair-diagram" aria-hidden="true"><i/><i/></span><span><strong>{pairWindow.taskbarTitle ?? pairWindow.title ?? APP_REGISTRY[pairWindow.app].label}</strong>放在左侧。选择另一个窗口放在右侧。</span><button onClick={() => setPairId(null)}>取消</button></div>}
      {windows.length === 0 ? <div className="future-empty-windows"><span aria-hidden="true">▱</span><p>还没有运行中的窗口</p><button onClick={() => onViewChange("apps")}>打开应用空间 ↗</button></div> :
        <div className="future-window-grid">{windows.map((instance) => {
          const app = APP_REGISTRY[instance.app];
          const title = instance.taskbarTitle ?? instance.title ?? app.label;
          return <article className={`future-window-card ${focused === instance.id ? "is-focused" : ""} ${pairWindow?.id === instance.id ? "is-pair-source" : ""}`} key={instance.id} onPointerMove={trackCardLight}>
            <button className="future-window-resume" onClick={() => resume(instance.id)} aria-label={`${instance.minimized ? "恢复" : "切换到"} ${title}`}>
              <span className="future-window-status">{instance.minimized ? "已最小化" : focused === instance.id ? "当前窗口" : "已打开"}</span>
              <i className={`shortcut-icon ${app.kind}-shortcut`} aria-hidden="true">{app.icon}</i>
              <strong>{title}</strong><small>{app.label}</small>
            </button>
            <footer>
              <button onClick={() => resume(instance.id)}>{instance.minimized ? "恢复窗口" : "进入窗口"} ↗</button>
              {!instance.minimized && <button aria-label={`最小化 ${title}`} onClick={() => onMinimize(instance.id)}>最小化</button>}
              <button aria-label={`关闭 ${title}`} onClick={() => { if (pairId === instance.id) setPairId(null); onClose(instance.id); }}>关闭</button>
            </footer>
            {windows.length > 1 && <button className="future-pair-button" aria-pressed={pairWindow?.id === instance.id} onClick={() => {
              if (!pairWindow) setPairId(instance.id);
              else if (pairWindow.id === instance.id) setPairId(null);
              else { setPairId(null); onPair(pairWindow.id, instance.id); }
            }}>{pairWindow?.id === instance.id ? "左侧窗口 · 取消选择" : pairWindow ? "放在右侧，开始并排 ↗" : "与另一个窗口并排"}</button>}
          </article>;
        })}</div>}
    </div>}
  </section>;
}
