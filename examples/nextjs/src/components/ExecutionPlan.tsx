import React from 'react';

interface ExecutionPlanProps {
  steps: string[];
}

const ExecutionPlan: React.FC<ExecutionPlanProps> = ({ steps }) => {
  return (
    <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-white/10 bg-white dark:bg-[#1C1A27] shadow-lg">
      <div className="flex items-center gap-4 border-b border-black/10 dark:border-white/10 px-4 py-3 sm:px-6">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/20">
          <span className="material-symbols-outlined">checklist</span>
        </div>
        <h2 className="flex-1 truncate text-lg font-semibold text-zinc-900 dark:text-white">
          Execution Plan
        </h2>
      </div>
      <div className="px-4 py-4 sm:px-6">
        <div className="grid grid-cols-[auto_1fr] gap-x-4">
          {steps.map((step, index) => (
            <React.Fragment key={index}>
              <div className="flex flex-col items-center gap-1">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary dark:bg-primary/20">
                  {index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div className="w-px grow bg-zinc-200 dark:bg-zinc-700"></div>
                )}
              </div>
              <div
                className={`pb-${index < steps.length - 1 ? '6' : '2'} pt-1`}
              >
                <p className="text-base font-medium text-zinc-800 dark:text-zinc-100">
                  {step}
                </p>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="border-t border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-black/20">
        <div className="flex flex-wrap items-center justify-end gap-3 px-4 py-3 sm:px-6">
          <button className="flex h-10 min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-zinc-300 bg-transparent px-4 text-sm font-bold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
            <span className="truncate">Reject</span>
          </button>
          <button className="flex h-10 min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary/90">
            <span className="truncate">Approve</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExecutionPlan;
