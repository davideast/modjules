import React from 'react';

const AgentChat = () => {
  return (
    <div className="flex flex-col h-screen">
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex justify-end">
            <p className="text-right text-base text-gray-700 dark:text-gray-300">
              Create a `features.md` file and populate it with 10 feature
              proposals.
            </p>
          </div>
          <div className="flex justify-center py-6">
            <div className="w-full max-w-3xl">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                  <span className="material-icons-outlined text-lg text-gray-300">
                    auto_awesome
                  </span>
                </div>
                <div className="flex-1 text-left">
                  <article className="prose prose-lg text-gray-100 dark:prose-dark max-w-none">
                    <p>
                      Okay, I've created the `features.md` file and populated it
                      with 10 feature proposals as requested.
                    </p>
                    <p>
                      The file is now ready for your review. Please let me know
                      if you would like any adjustments or if there is anything
                      else I can help with.
                    </p>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <footer className="p-4 md:p-6 lg:p-8 pt-0">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <input
              className="w-full bg-gray-100 dark:bg-gray-800/30 border-none rounded-full py-3 pl-6 pr-24 text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background-light dark:focus:ring-offset-background-dark"
              placeholder="Suggest new branches or refine steps..."
              type="text"
            />
            <div className="absolute inset-y-0 right-2 flex items-center space-x-1">
              <button className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50">
                <span className="material-icons-outlined">mic</span>
              </button>
              <button className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:opacity-90 transition-opacity">
                <span className="material-icons-outlined">arrow_upward</span>
              </button>
            </div>
          </div>
          <p className="text-center text-xs text-gray-500 dark:text-gray-500 mt-3">
            Jules can make mistakes so double-check it and{' '}
            <a className="underline" href="#">
              use code with caution
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default AgentChat;
