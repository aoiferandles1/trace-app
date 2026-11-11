"use client";

import { StatePage } from "@/components/layout/StatePage";

/**
 * A page that failed while showing (BRIEF.md section 7's error state): a
 * title, one line, one text button that tries again. Data that fails to
 * load inside a screen has its own line (`LoadStatus`); this is for
 * anything else.
 */
export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <StatePage
      title="Something went wrong"
      message="This page couldn't be shown. Check your connection and try again."
      action={{ label: "Try again", onClick: () => retry() }}
    />
  );
}
