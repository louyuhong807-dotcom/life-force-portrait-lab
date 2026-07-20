"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

const repairKey = "life-force-cruise-repair";

function clearLifeForceCache() {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key?.startsWith("life-force-") && key !== repairKey) storage.removeItem(key);
    }
  }
}

type State = { error: Error | null; repairing: boolean };

export default class RuntimeGuard extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, repairing: false };

  static getDerivedStateFromError(error: Error): State {
    return { error, repairing: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const log = JSON.stringify({
      at: new Date().toISOString(),
      message: error.message,
      stack: info.componentStack?.slice(0, 2_000) ?? "",
    });
    window.sessionStorage.setItem("life-force-cruise-last-error", log);

    if (window.sessionStorage.getItem(repairKey) !== "done") {
      window.sessionStorage.setItem(repairKey, "done");
      this.setState({ repairing: true });
      clearLifeForceCache();
      window.setTimeout(() => window.location.reload(), 700);
    }
  }

  repair = () => {
    clearLifeForceCache();
    window.sessionStorage.removeItem(repairKey);
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="runtime-repair" role="alert">
        <span>AI 自动巡航</span>
        <h1>{this.state.repairing ? "正在自动修复…" : "页面遇到一个临时问题"}</h1>
        <p>{this.state.repairing ? "正在清理异常状态并重新载入。" : "自动修复未能完成，可以安全地再试一次。"}</p>
        {!this.state.repairing && <button type="button" onClick={this.repair}>修复并重新打开</button>}
      </main>
    );
  }
}
