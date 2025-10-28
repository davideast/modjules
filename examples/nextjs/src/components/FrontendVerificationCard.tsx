import React from 'react';

interface FrontendVerificationCardProps {
  screenshotUrl: string;
}

const FrontendVerificationCard: React.FC<FrontendVerificationCardProps> = ({
  screenshotUrl,
}) => {
  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden">
      <div className="layout-container flex h-full grow flex-col">
        <div className="flex flex-1 justify-center p-4 sm:p-6 md:p-8">
          <div className="layout-content-container flex flex-col w-full max-w-[640px] flex-1">
            {/* Verification Card */}
            <div className="group/card relative w-full flex flex-col bg-white dark:bg-background-dark border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
              {/* Card Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                <div className="text-primary flex items-center justify-center rounded-lg bg-primary/20 shrink-0 size-8">
                  <span className="material-symbols-outlined text-lg">
                    visibility
                  </span>
                </div>
                <p className="text-zinc-900 dark:text-zinc-100 text-base font-semibold leading-normal flex-1 truncate">
                  Frontend Verification
                </p>
              </div>
              {/* Image Container */}
              <div className="relative w-full bg-zinc-100 dark:bg-black/20 aspect-[16/9]">
                <div
                  className="w-full h-full bg-center bg-no-repeat bg-cover"
                  data-alt="A screenshot of a modern web application interface showing charts and a navigation sidebar."
                  style={{
                    backgroundImage: `url("${screenshotUrl}")`,
                  }}
                ></div>
              </div>
              {/* Action Bar (Appears on card hover) */}
              <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200">
                <button className="flex items-center justify-center gap-2 bg-zinc-900/80 backdrop-blur-sm text-white h-10 px-4 rounded-lg hover:bg-zinc-900 transition-colors">
                  <span className="material-symbols-outlined text-base">
                    content_copy
                  </span>
                  <span className="text-sm font-medium">Copy</span>
                </button>
                <button className="flex items-center justify-center gap-2 bg-zinc-900/80 backdrop-blur-sm text-white h-10 px-4 rounded-lg hover:bg-zinc-900 transition-colors">
                  <span className="material-symbols-outlined text-base">
                    download
                  </span>
                  <span className="text-sm font-medium">Download</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FrontendVerificationCard;
