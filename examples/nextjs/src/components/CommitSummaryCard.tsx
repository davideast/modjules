import React from 'react';

interface CommitSummaryCardProps {
  commitSummary: string;
}

const CommitSummaryCard: React.FC<CommitSummaryCardProps> = ({
  commitSummary,
}) => {
  return (
    <div className="w-full max-w-lg rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark shadow-md">
      {/* Card Header */}
      <div className="flex items-center gap-3 border-b border-border-light dark:border-border-dark px-5 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
          <span className="material-symbols-outlined text-xl">
            check_circle
          </span>
        </div>
        <h2 className="flex-1 truncate text-base font-bold text-text-light dark:text-text-dark">
          Session Complete
        </h2>
      </div>
      {/* Card Body */}
      <div className="p-5">
        {/* MetaText: Suggested Commit Label */}
        <p className="font-display text-xs font-bold uppercase tracking-wider text-meta-light dark:text-meta-dark">
          Suggested Commit
        </p>
        {/* BodyText: Commit Message Code Block */}
        <div className="relative mt-2 rounded-lg border border-border-light dark:border-border-dark bg-code-bg-light dark:bg-code-bg-dark p-4 group">
          <pre className="whitespace-pre-wrap font-mono text-sm text-text-light dark:text-text-dark">
            <code>{commitSummary}</code>
          </pre>
          <button
            aria-label="Copy commit message"
            className="absolute top-2 right-2 flex cursor-pointer items-center justify-center rounded-md bg-white/50 p-1.5 text-meta-light opacity-0 transition-opacity hover:bg-black/10 dark:bg-black/50 dark:text-meta-dark dark:hover:bg-white/10 group-hover:opacity-100 focus:opacity-100"
          >
            <span className="material-symbols-outlined text-base">
              content_copy
            </span>
          </button>
        </div>
      </div>
      {/* Card Footer (Action Bar) */}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border-light dark:border-border-dark px-5 py-4">
        {/* Secondary Button */}
        <button className="flex h-9 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-transparent px-4 text-sm font-bold text-text-light ring-1 ring-inset ring-border-light transition-colors hover:bg-gray-100 dark:text-text-dark dark:ring-border-dark dark:hover:bg-gray-800">
          <span className="truncate">Download Patch</span>
        </button>
        {/* Primary Button */}
        <button className="flex h-9 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-primary px-4 text-sm font-bold text-white transition-opacity hover:opacity-90">
          <span className="truncate">Commit Changes</span>
        </button>
      </div>
    </div>
  );
};

export default CommitSummaryCard;
