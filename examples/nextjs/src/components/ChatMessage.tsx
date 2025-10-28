import React from 'react';

interface ChatMessageProps {
  originator: 'user' | 'agent';
  message: string;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ originator, message }) => {
  if (originator === 'user') {
    return (
      <div className="flex justify-end">
        <p className="text-right text-base text-gray-700 dark:text-gray-300">
          {message}
        </p>
      </div>
    );
  }

  return (
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
              <p>{message}</p>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
