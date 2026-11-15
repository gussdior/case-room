"use client";

import { useState } from "react";
import { inputClass, labelClass } from "@/components/forms";

// Creator only: list the case publicly with a one line goal, with a live preview of the public card.
export function ListingFields({
  listed,
  cancerType,
  cancerStage,
  publicGoal,
}: {
  listed: boolean;
  cancerType: string | null;
  cancerStage: string | null;
  publicGoal: string | null;
}) {
  const [on, setOn] = useState(listed);
  const [type, setType] = useState(cancerType ?? "");
  const [stage, setStage] = useState(cancerStage ?? "");
  const [goal, setGoal] = useState(publicGoal ?? "");

  return (
    <>
      <input type="hidden" name="listed_present" value="1" />
      <label htmlFor="s-cancer" className={labelClass}>
        Cancer type
      </label>
      <input
        id="s-cancer"
        name="cancer_type"
        maxLength={60}
        placeholder="For example: Lung cancer"
        value={type}
        onChange={(e) => setType(e.target.value)}
        className={inputClass}
      />
      <label htmlFor="s-stage" className={labelClass}>
        Stage or type, optional
      </label>
      <input
        id="s-stage"
        name="cancer_stage"
        maxLength={40}
        placeholder="For example: Stage IV"
        value={stage}
        onChange={(e) => setStage(e.target.value)}
        className={inputClass}
      />
      <label className="flex cursor-pointer items-start gap-3 rounded-[12px] bg-paper p-4">
        <input
          type="checkbox"
          name="listed"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          className="mt-1 h-4 w-4 flex-none accent-brand"
        />
        <span>
          <span className="block text-[15px] font-semibold">List this case publicly so volunteers can find it</span>
          <span className="block text-[13px] text-muted">
            It shows on the homepage and matching volunteers get notified. You still approve each person.
          </span>
        </span>
      </label>
      {on && (
        <div className="fade-in flex flex-col gap-2">
          <label htmlFor="s-public" className={labelClass}>
            One line public goal
          </label>
          <input
            id="s-public"
            name="public_goal"
            required
            minLength={10}
            maxLength={140}
            placeholder="For example: Find her next options after the first pill stopped working"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className={inputClass}
            aria-describedby="s-public-note"
          />
          <p id="s-public-note" className="text-[13px] text-muted">
            No names, photos or details from your documents are shown. {140 - goal.length} characters left.
          </p>
          <p className="mt-1 text-[13px] font-semibold">Preview of the public card</p>
          <div aria-hidden="true" className="flex flex-col gap-2 rounded-[14px] border border-line bg-sheet p-5">
            <div className="flex gap-2.5 text-[13px] text-muted">
              <span>{type.trim() || "Cancer case"}</span>
              {stage.trim() && <span>{stage.trim()}</span>}
            </div>
            <p className="font-display text-xl leading-tight font-medium">{goal.trim() || "Your one line goal shows here"}</p>
            <p className="text-[13px] text-muted">Lead counts, professions needed and how many people help are added for you.</p>
          </div>
        </div>
      )}
    </>
  );
}
