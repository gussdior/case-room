import { pinMessage, postMessage, reportMessage } from "@/app/case-actions";
import { memberById } from "@/lib/data";
import type { CaseRoom, Message } from "@/lib/types";
import { DemoButton } from "./demo-button";
import { ActionButton, ActionForm, SubmitButton, inputClass, labelClass } from "./forms";
import { Avatar, Badge, PersonLink } from "./ui";

export function MessageItem({ room, msg, compact }: { room: CaseRoom; msg: Message; compact?: boolean }) {
  const author = memberById(room, msg.authorId);
  const task = msg.taskId ? room.tasks.find((t) => t.id === msg.taskId) : undefined;
  const isOwner = task && task.ownerId === msg.authorId;
  const wantsToJoin = task && msg.authorId && task.requestedHelperIds.includes(msg.authorId);
  const viewer = room.viewer;
  const canReport = viewer && !msg.isAi && msg.authorId !== viewer.id;

  return (
    <article className="flex gap-3">
      <Avatar person={author} ai={msg.isAi} size={compact ? 32 : 36} />
      <div className={`flex min-w-0 flex-1 flex-col gap-1.5 ${msg.isAi ? "rounded-xl border border-line bg-paper px-3.5 py-3" : ""}`}>
        <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-[13px]">
          <strong>{msg.isAi ? "AI helper" : author ? <PersonLink person={author} /> : "Former member"}</strong>
          {isOwner && <span className="text-subtle">task owner</span>}
          <span className="text-subtle">{msg.createdAt}</span>
          {msg.kind === "stuck" && <Badge tone="bad">Stuck</Badge>}
          {wantsToJoin && <Badge tone="warn">Wants to help</Badge>}
          {msg.pinned && <Badge tone="brand">Pinned</Badge>}
        </div>
        <p className="whitespace-pre-line break-words text-[14px] leading-relaxed text-ink-2">{msg.body}</p>
        {msg.sources && msg.sources.length > 0 && (
          <div className="flex flex-wrap gap-3 text-xs">
            {msg.sources.map((s, i) => (
              <a key={i} href={s} target="_blank" rel="noopener noreferrer nofollow">
                Source {i + 1}
              </a>
            ))}
          </div>
        )}
        {(canReport || viewer?.isAdmin) && (
          <div className="flex flex-wrap items-start gap-3 text-xs">
            {viewer?.isAdmin && !msg.taskId && (
              <ActionButton action={pinMessage.bind(null, room.id, msg.id, !msg.pinned)} className="min-h-8 px-2 text-xs">
                {msg.pinned ? "Unpin" : "Pin"}
              </ActionButton>
            )}
            {canReport && (
              <details>
                <summary className="flex min-h-8 cursor-pointer items-center text-subtle">Report</summary>
                <ActionForm action={reportMessage.bind(null, room.id, msg.id)} className="mt-2 flex flex-col gap-2">
                  <label className={labelClass} htmlFor={`r-${msg.id}`}>
                    What&apos;s wrong?
                  </label>
                  <input
                    id={`r-${msg.id}`}
                    name="reason"
                    required
                    maxLength={500}
                    placeholder="e.g. treatment advice, asking for money, rude"
                    className={inputClass}
                  />
                  <SubmitButton variant="secondary">Send report</SubmitButton>
                </ActionForm>
              </details>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export function Composer({
  room,
  taskId,
  label,
  placeholder,
  children,
}: {
  room: CaseRoom;
  taskId: string | null;
  label: string;
  placeholder: string;
  children?: React.ReactNode;
}) {
  const id = taskId ? `msg-${taskId}` : "casemsg";
  if (!room.viewer) {
    return (
      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
        <textarea id={id} rows={2} placeholder={placeholder} className={`${inputClass} resize-y`} />
        <div className="flex flex-wrap items-center gap-2.5">
          {children}
          <span className="ml-auto">
            <DemoButton variant="primary">Post</DemoButton>
          </span>
        </div>
      </div>
    );
  }
  return (
    <ActionForm action={postMessage.bind(null, room.id, taskId)} className="flex flex-col gap-2 border-t border-line pt-3">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <textarea id={id} name="body" rows={3} required maxLength={4000} placeholder={placeholder} className={`${inputClass} resize-y`} />
      <label htmlFor={`${id}-src`} className="text-xs text-subtle">
        Source link (needed for any medical claim)
      </label>
      <input id={`${id}-src`} name="source" type="url" placeholder="https://" className={inputClass} />
      <div className="flex flex-wrap items-center gap-2.5">
        {children}
        <span className="ml-auto">
          <SubmitButton>Post</SubmitButton>
        </span>
      </div>
    </ActionForm>
  );
}
