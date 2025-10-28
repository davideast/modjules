import React from 'react';

interface ChatMessageProps {
  sender: 'user' | 'agent';
  text: string;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ sender, text }) => {
  const getSenderBgColor = () => {
    switch (sender) {
      case 'user':
        return 'bg-blue-600 text-white self-end';
      case 'agent':
        return 'bg-zinc-800 text-zinc-100 self-start';
      default:
        return 'bg-zinc-800';
    }
  };

  return (
    <div className="flex flex-col">
      <div
        className={`max-w-xs md:max-w-md p-3 rounded-lg ${getSenderBgColor()}`}
      >
        <p>{text}</p>
      </div>
    </div>
  );
};

export default ChatMessage;
