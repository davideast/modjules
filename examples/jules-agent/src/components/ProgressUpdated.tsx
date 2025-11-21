'use client';
import { ActivityProgressUpdated } from 'modjules';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import React, { useState } from 'react';

export const ProgressUpdated = ({
  activity,
}: {
  activity: ActivityProgressUpdated;
}) => {
  const [isCopied, setIsCopied] = useState(false);

  const title = activity.progressUpdated?.title || 'Progress Update';
  const bashArtifact = activity.artifacts?.find((a) => a.type === 'bashOutput');

  const command =
    bashArtifact?.type === 'bashOutput' ? bashArtifact.command.trim() : '';
  const output =
    bashArtifact?.type === 'bashOutput'
      ? (bashArtifact.stdout + bashArtifact.stderr).trim()
      : '';

  const handleCopy = () => {
    if (!command && !output) return;
    const textToCopy = `# Command\n\n${command}\n\n# Output\n\n${output}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    });
  };

  // Do not render anything if there's no relevant artifact
  if (!bashArtifact) {
    return null;
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#1d1b2c] text-white font-display">
      {/* Card Header */}
      <div className="flex items-center gap-4 bg-black/20 px-4 py-3">
        <div className="flex items-center justify-center rounded-lg bg-primary/30 size-10 shrink-0 text-primary">
          <span className="material-symbols-outlined text-xl">terminal</span>
        </div>
        <p className="flex-1 text-base font-medium leading-normal text-white/90">
          {title}
        </p>
        <button
          aria-label="Copy code"
          onClick={handleCopy}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <span className="material-symbols-outlined text-lg">
            {isCopied ? 'check' : 'content_copy'}
          </span>
        </button>
      </div>
      {/* Card Body */}
      <div className="flex flex-col p-4">
        {/* Command Section */}
        {command && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
              COMMAND
            </p>
            <SyntaxHighlighter
              language="bash"
              style={vscDarkPlus}
              customStyle={{
                margin: 0,
                padding: '0.75rem',
                backgroundColor: 'rgba(0,0,0,0.2)',
                borderRadius: '0.375rem',
              }}
              codeTagProps={{
                style: {
                  fontFamily: 'inherit',
                  fontSize: '0.875rem',
                  lineHeight: '1.25rem',
                  color: 'rgba(255,255,255,0.8)',
                },
              }}
            >
              {command}
            </SyntaxHighlighter>
          </div>
        )}

        {command && output && (
          <div className="my-4 h-px w-full bg-white/10"></div>
        )}

        {/* Output Section */}
        {output && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
              OUTPUT
            </p>
            <SyntaxHighlighter
              language="text"
              style={vscDarkPlus}
              customStyle={{
                margin: 0,
                padding: '0.75rem',
                backgroundColor: 'rgba(0,0,0,0.2)',
                borderRadius: '0.375rem',
                maxHeight: '240px',
                overflowY: 'auto',
              }}
              codeTagProps={{
                style: {
                  fontFamily: 'inherit',
                  fontSize: '0.875rem',
                  lineHeight: '1.5rem',
                  color: 'rgba(255,255,255,0.8)',
                },
              }}
            >
              {output}
            </SyntaxHighlighter>
          </div>
        )}
      </div>
    </div>
  );
};
