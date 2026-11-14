import type { CaseRoom, Message } from "@/lib/types";
import { memberById } from "@/lib/data";
import { Avatar, Badge } from "./ui";

export function MessageItem({ room, msg, compact }: { room: CaseRoom; msg: Message; compact?: boolean }) {
  const author = memberById(room, msg.authorId);
  const isOwner = msg.taskId && room.tasks.find((t) => t.id === msg.taskId)?.ownerId === msg.authorId;
  const wantsToJoin =
    msg.taskId && msg.authorId && room.tasks.find((t) => t.id === msg.taskId)?.requestedHelperIds.includes(msg.authorId);

  return (
    <article className="flex gap-3">
      <Avatar person={author} ai={msg.isAi} size={compact ? 32 : 36} />
      <div className={`flex min-w-0 flex-1 flex-col gap-1.5 ${msg.isAi ? "rounded-xl bg-soft px-3.5 py-3" : ""}`}>
        <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-[13px]">
          <strong>{msg.isAi ? "AI helper" : author?.name}</strong>
          <span className="text-subtle">
            {isOwner ? "· owner " : ""}· {msg.createdAt}
          </span>
          {msg.kind === "stuck" && <Badge tone="bad">Stuck</Badge>}
          {wantsToJoin && <Badge tone="warn">Wants to join</Badge>}
        </div>
        <p className="text-sm leading-relaxed">{msg.body}</p>
        {msg.sources && msg.sources.length > 0 && (
          <div className="flex flex-wrap gap-3 text-xs">
            {msg.sources.map((s, i) => (
              <a key={i} href={s} target="_blank" rel="noreferrer">
                Source {i + 1}
              </a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export function Composer({ id, label, placeholder }: { id: string; label: string; placeholder: string }) {
  return (
    <div className="flex flex-col gap-2 border-t border-[#ebeef3] pt-3">
      <label htmlFor={id} className="text-[13px] font-semibold">
        {label}
      </label>
      <textarea
        id={id}
        rows={2}
        placeholder={placeholder}
        className="w-full resize-y rounded-[10px] border border-line-2 p-2.5 text-sm"
      />
    </div>
  );
}
