"use client";

import { useState } from "react";
import { btn } from "./ui";

/**
 * A real button that, in the sample case, explains that actions
 * switch on once sign in and the database are connected.
 */
export function DemoButton({
  children,
  variant = "secondary",
  className = "",
}: {
  children: React.ReactNode;
  variant?: keyof typeof btn;
  className?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" className={`${btn[variant]} ${className}`} onClick={() => setShown(true)}>
        {children}
      </button>
      {shown && (
        <span role="status" className="text-xs text-subtle">
          Sample case: this works once sign in is connected.
        </span>
      )}
    </span>
  );
}
