import React from 'react';

interface BashCommandOutputProps {
  command: string;
  output: string;
}

const BashCommandOutput: React.FC<BashCommandOutputProps> = ({
  command,
  output,
}) => {
  return (
    <div className="w-full max-w-2xl">
      <div className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#1d1b2c] text-white">
        <div className="flex items-center gap-4 bg-black/20 px-4 py-3">
          <div className="flex items-center justify-center rounded-lg bg-primary/30 size-10 shrink-0 text-primary">
            <span className="material-symbols-outlined text-xl">terminal</span>
          </div>
          <p className="flex-1 text-base font-medium leading-normal text-white/90">
            Ran Bash Command
          </p>
          <button
            aria-label="Copy code"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <span className="material-symbols-outlined text-lg">
              content_copy
            </span>
          </button>
        </div>
        <div className="flex flex-col p-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
              COMMAND
            </p>
            <pre className="font-mono text-sm text-white/80">
              <code>{command}</code>
            </pre>
          </div>
          <div className="my-4 h-px w-full bg-white/10"></div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
              OUTPUT
            </p>
            <pre className="max-h-60 overflow-y-auto rounded-md bg-black/20 p-3 font-mono text-sm leading-relaxed text-white/80">
              <code>{output}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BashCommandOutput;
