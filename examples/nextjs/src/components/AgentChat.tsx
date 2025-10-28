import React from 'react';

interface AgentChatProps {
  children: React.ReactNode;
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

const AgentChat: React.FC<AgentChatProps> = ({
  children,
  input,
  onInputChange,
  onSubmit,
}) => {
  return (
    <div className="flex flex-col h-screen">
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-8">{children}</div>
      </main>
      <footer className="p-4 md:p-6 lg:p-8 pt-0">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={onSubmit}>
            <div className="relative">
              <input
                className="w-full bg-gray-100 dark:bg-gray-800/30 border-none rounded-full py-3 pl-6 pr-24 text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background-light dark:focus:ring-offset-background-dark"
                placeholder="Suggest new branches or refine steps..."
                type="text"
                value={input}
                onChange={onInputChange}
              />
              <div className="absolute inset-y-0 right-2 flex items-center space-x-1">
                <button
                  type="button"
                  className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50"
                >
                  <span className="material-icons-outlined">mic</span>
                </button>
                <button
                  type="submit"
                  className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:opacity-90 transition-opacity"
                >
                  <span className="material-icons-outlined">arrow_upward</span>
                </button>
              </div>
            </div>
          </form>
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
