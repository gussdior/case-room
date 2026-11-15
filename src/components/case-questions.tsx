import { answerQuestion, inviteAsker } from "@/app/question-actions";
import type { MyQuestion, PublicQuestion, TeamQuestion } from "@/lib/db-questions";
import { timeAgo } from "@/lib/time";
import { roleLabel } from "@/lib/types";
import { PublicToggle } from "./ask-team";
import { DemoButton } from "./demo-button";
import { ActionButton, ActionForm, SubmitButton } from "./forms";
import { Avatar, Card } from "./ui";

/** Answered questions the team chose to show on the public preview. Never shows names. */
export function AnsweredQuestions({ questions }: { questions: PublicQuestion[] }) {
  if (questions.length === 0) return null;
  return (
    <section aria-labelledby="answered-title" className="mt-6">
      <h2 id="answered-title" className="mb-1 text-[15px] font-bold">
        Answered questions
      </h2>
      <ul>
        {questions.map((q, i) => (
          <li key={i} className="border-t border-line py-3">
            <p className="text-[15px] font-bold">{q.body}</p>
            <p className="mt-1 font-display text-base leading-relaxed text-ink-2">
              {q.reply} <span className="font-sans text-xs text-muted">Answered by the team</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The visitor's own questions and the team's replies, on the preview. */
export function YourQuestions({ questions }: { questions: MyQuestion[] }) {
  if (questions.length === 0) return null;
  return (
    <section aria-labelledby="yours-title" className="mt-6">
      <h2 id="yours-title" className="mb-1 text-[15px] font-bold">
        Your questions
      </h2>
      <ul>
        {questions.map((q) => (
          <li key={q.id} className="border-t border-line py-3">
            <p className="text-[15px]">{q.body}</p>
            {q.reply ? (
              <p className="mt-2 rounded-[10px] bg-paper px-3 py-2 text-sm">
                <b className="mr-1.5">The team replied</b>
                {q.reply}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted">Waiting for a reply. Asked {timeAgo(q.createdAt)}.</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The team's inbox of visitor questions. Admins can publish answers and invite the asker. */
export function QuestionsInbox({
  caseId,
  questions,
  canManage,
  demo = false,
}: {
  caseId: string;
  questions: TeamQuestion[];
  canManage: boolean;
  demo?: boolean;
}) {
  const unanswered = questions.filter((q) => !q.reply).length;
  return (
    <Card label="Questions from visitors" className="flex flex-col gap-1">
      <div className="mb-2 flex flex-wrap items-baseline gap-2.5">
        <h2 className="font-display text-xl font-medium">Questions from visitors</h2>
        {unanswered > 0 && (
          <span className="rounded-full bg-mark px-2 py-0.5 text-[12px] font-semibold text-ink">{unanswered} new</span>
        )}
      </div>
      {questions.length === 0 && (
        <p className="text-sm text-muted">
          No questions yet. When the public preview is on, people can ask the team a question before they join.
        </p>
      )}
      {questions.map((q) => {
        const asker = { id: q.askerId, name: q.askerInitial, headline: "", expertise: q.askerExpertise };
        const who = `${q.askerInitial}, ${roleLabel({ roleTitle: q.askerRoleTitle, expertise: q.askerExpertise })}`;
        const onCase = q.askerStatus === "approved";
        return (
          <article key={q.id} className="flex flex-col gap-2.5 border-t border-line py-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Avatar person={asker} size={28} />
              <b>{who}</b>
              {onCase && <span className="text-xs text-ok">On the case now</span>}
              {q.askerStatus === "pending" && <span className="text-xs text-muted">Also asked to join</span>}
              <span className="ml-auto text-xs text-muted">{timeAgo(q.createdAt)}</span>
            </div>
            <p className="text-[15px]">{q.body}</p>
            {q.reply && (
              <p className="rounded-[10px] bg-paper px-3 py-2.5 text-sm">
                <b className="mr-1.5">{q.repliedByName ? `${q.repliedByName} replied` : "The team replied"}</b>
                {q.reply}
              </p>
            )}
            {!q.reply &&
              (demo ? (
                <div className="flex flex-col gap-2">
                  <textarea className="field min-h-[72px]" placeholder="Write a reply" aria-label={`Reply to ${who}`} />
                  <DemoButton variant="mark" className="btn-sm self-start">
                    Reply
                  </DemoButton>
                </div>
              ) : (
                <ActionForm action={answerQuestion.bind(null, caseId, q.id)} className="flex flex-col gap-2">
                  <label htmlFor={`reply-${q.id}`} className="sr-only">
                    Reply to {who}
                  </label>
                  <textarea
                    id={`reply-${q.id}`}
                    name="reply"
                    required
                    minLength={2}
                    maxLength={1000}
                    rows={2}
                    placeholder="Write a reply. Keep it general, with no names or records."
                    className="field min-h-[72px] resize-y"
                  />
                  <SubmitButton variant="mark" className="btn-sm self-start">
                    Reply
                  </SubmitButton>
                </ActionForm>
              ))}
            {canManage && (
              <div className="flex flex-wrap items-center gap-2">
                {!onCase &&
                  (demo ? (
                    <DemoButton className="btn-sm">Invite to join</DemoButton>
                  ) : (
                    <ActionButton action={inviteAsker.bind(null, caseId, q.id)} className="btn-sm">
                      Invite to join
                    </ActionButton>
                  ))}
                <PublicToggle caseId={caseId} questionId={q.id} initial={q.isPublic} disabled={!q.reply} demo={demo} />
              </div>
            )}
          </article>
        );
      })}
    </Card>
  );
}
