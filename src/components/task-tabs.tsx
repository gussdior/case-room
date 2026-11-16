"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Ask AI and Discussion side by side, with a sliding underline. */
export function TaskTabs({ ai, discussion, newCount }: { ai: ReactNode; discussion: ReactNode; newCount: number }) {
  const [tab, setTab] = useState<"ai" | "dis">("ai");
  useEffect(() => {
    const pick = () => {
      if (window.location.hash === "#discussion" || window.location.hash === "#help") setTab("dis");
      if (window.location.hash === "#ai") setTab("ai");
    };
    pick();
    window.addEventListener("hashchange", pick);
    return () => window.removeEventListener("hashchange", pick);
  }, []);
  const tabs = [
    { id: "ai" as const, label: "Ask AI" },
    { id: "dis" as const, label: "Discussion" },
  ];
  return (
    <section id="ai" aria-label="Help on this idea" className="panel scroll-mt-6 overflow-hidden lg:sticky lg:top-5">
      <div role="tablist" aria-label="Help on this idea" className="relative grid grid-cols-2 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`pane-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`flex min-h-[52px] items-center justify-center gap-2 font-semibold transition-colors hover:bg-[#f6f7f6] ${
              tab === t.id ? "text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
            {t.id === "dis" && newCount > 0 && (
              <span className="rounded-full bg-mark px-2 text-[11px] text-ink">{newCount}</span>
            )}
          </button>
        ))}
        <span
          aria-hidden="true"
          className="absolute bottom-[-1px] left-0 h-[3px] w-1/2 bg-ink transition-transform duration-300 ease-[cubic-bezier(.3,.7,.2,1)]"
          style={{ transform: tab === "dis" ? "translateX(100%)" : "none" }}
        />
      </div>
      <div id="pane-ai" role="tabpanel" aria-labelledby="tab-ai" hidden={tab !== "ai"} className="fade-in p-5 sm:p-[22px]">
        {ai}
      </div>
      <div id="pane-dis" role="tabpanel" aria-labelledby="tab-dis" hidden={tab !== "dis"} className="fade-in p-5 sm:p-[22px]">
        <div id="discussion" className="scroll-mt-6" />
        {discussion}
      </div>
    </section>
  );
}
