import React from 'react';

interface FileModifiedNotificationProps {
  filepath: string;
  description: string;
}

const FileModifiedNotification: React.FC<FileModifiedNotificationProps> = ({
  filepath,
  description,
}) => {
  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark group/design-root overflow-x-hidden">
      <div className="layout-container flex h-full grow flex-col">
        <div className="flex flex-1 justify-center p-4 sm:p-6 md:p-10">
          <div className="layout-content-container flex flex-col w-full max-w-2xl flex-1">
            {/* Card Component */}
            <div className="flex w-full flex-col overflow-hidden rounded-xl border border-gray-200/50 dark:border-white/10 bg-white dark:bg-[#1E1E1E] transition-all hover:shadow-md dark:hover:border-white/20">
              {/* Card Header */}
              <div className="flex items-center gap-3 border-b border-gray-200/50 dark:border-white/10 p-4">
                <span className="material-symbols-outlined text-xl text-gray-500 dark:text-gray-400">
                  difference
                </span>
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  Modified{' '}
                  <code className="font-mono rounded bg-gray-100 dark:bg-black/20 px-1.5 py-1 text-primary">
                    {filepath}
                  </code>
                </p>
              </div>
              {/* Card Body */}
              <div className="flex flex-col gap-4 p-4">
                <div className="flex flex-1 flex-col justify-center">
                  <p className="text-base font-medium leading-normal text-gray-900 dark:text-gray-50">
                    {description}
                  </p>
                  <p className="text-sm font-normal leading-normal text-gray-500 dark:text-gray-400">
                    from your-project-repository
                  </p>
                </div>
              </div>
              {/* Card Footer */}
              <div className="flex items-center justify-end border-t border-gray-200/50 dark:border-white/10 p-3">
                <button className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-9 px-4 bg-primary text-white text-sm font-medium leading-normal w-fit transition-opacity hover:opacity-90 active:opacity-80">
                  <span className="truncate">View Diff</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileModifiedNotification;
