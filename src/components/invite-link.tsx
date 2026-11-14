"use client";

import { useState, useSyncExternalStore } from "react";
import { btn } from "./ui";

const subscribe = () => () => {};

export function InviteLink({ caseId }: { caseId: string }) {
  const origin = useSyncExternalStore(subscribe, () => window.location.origin, () => "");
  const [copied, setCopied] = useState(false);
  const url = `${origin}/case/${caseId}`;
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-soft p-3 text-xs">
      <span className="font-semibold">Invite link: people ask to join, the creator approves</span>
      <code className="break-all select-all">{url}</code>
      <button
        type="button"
        className={`${btn.secondary} self-start`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copied" : "Copy invite link"}
      </button>
    </div>
  );
}
