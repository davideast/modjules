import React from 'react';
import { Plan } from 'julets';

interface PlanCardProps {
  plan: Plan;
  onApprove: () => void;
}

const PlanCard: React.FC<PlanCardProps> = ({ plan, onApprove }) => {
  return (
    <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-white/10 bg-white dark:bg-[#1C1A27] shadow-lg">
      {/* Card Header */}
      <div className="flex items-center gap-4 border-b border-black/10 dark:border-white/10 px-4 py-3 sm:px-6">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/20">
          <span className="material-symbols-outlined">checklist</span>
        </div>
        <h2 className="flex-1 truncate text-lg font-semibold text-zinc-900 dark:text-white">
          Execution Plan
        </h2>
      </div>

      {/* Card Body: Timeline */}
      <div className="px-4 py-4 sm:px-6">
        <div className="grid grid-cols-[auto_1fr] gap-x-4">
          {plan.steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center gap-1">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary dark:bg-primary/20">
                  {index + 1}
                </div>
                {index < plan.steps.length - 1 && (
                  <div className="w-px grow bg-zinc-200 dark:bg-zinc-700"></div>
                )}
              </div>
              <div
                className={
                  index < plan.steps.length - 1 ? 'pb-6 pt-1' : 'pb-2 pt-1'
                }
              >
                <p className="text-base font-medium text-zinc-800 dark:text-zinc-100">
                  {step.description || step.title}
                </p>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Card Footer: Button Group */}
      <div className="border-t border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-black/20">
        <div className="flex flex-wrap items-center justify-end gap-3 px-4 py-3 sm:px-6">
          <button
            onClick={onApprove}
            className="flex h-10 min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary/90"
          >
            <span className="truncate">Approve</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanCard;
