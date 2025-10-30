'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Activity } from 'julets';

// Define the shape of a message for the UI
interface Message {
  id: string;
  text: string;
  originator: 'user' | 'agent';
}

export default function Chat() {
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get('session');

  if (!sessionParam) {
    throw new Error('You need a session id');
  }
  const [sessionId, setSessionId] = useState<string | null>(sessionParam);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const agentMessageRef = useRef<string>('');

  // Listen for agent activities when the session ID is available
  useEffect(() => {
    if (!sessionId) return;

    const eventSource = new EventSource(`/api/session/${sessionId}/stream`);

    eventSource.onmessage = (event) => {
      const activity: Activity = JSON.parse(event.data);
      if (activity.type === 'agentMessaged') {
        setIsStreaming(true);
        agentMessageRef.current = '';
        agentMessageRef.current += activity.message;
        // Update the last message in the messages array with the streamed content
        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage && lastMessage.originator === 'agent') {
            return [
              ...prev.slice(0, -1),
              { ...lastMessage, text: agentMessageRef.current },
            ];
          } else {
            return [
              ...prev,
              {
                id: activity.id,
                text: agentMessageRef.current,
                originator: 'agent',
              },
            ];
          }
        });
      } else if (activity.type === 'userMessaged') {
        setMessages((prev) => [
          ...prev,
          { id: activity.id, text: activity.message, originator: 'user' },
        ]);
      }
    };

    eventSource.onerror = (err) => {
      console.error('EventSource failed:', err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [sessionId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSendMessage = async () => {
    if (input.trim() === '' || !sessionId) return;

    await fetch(`/api/session/${sessionId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: input }),
    });

    setInput('');
  };

  return (
    <div className="flex flex-col h-screen">
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.originator === 'user' ? 'justify-end' : 'justify-center py-6'}`}
            >
              {msg.originator === 'user' ? (
                <p className="text-right text-base text-gray-700 dark:text-gray-300">
                  {msg.text}
                </p>
              ) : (
                <div className="w-full max-w-3xl">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                      <span className="material-icons-outlined text-lg text-gray-300">
                        auto_awesome
                      </span>
                    </div>
                    <div className="flex-1 text-left">
                      <article className="prose prose-lg text-gray-100 dark:prose-dark max-w-none">
                        <p>{msg.text}</p>
                      </article>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
      <footer className="p-4 md:p-6 lg:p-8 pt-0">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <input
              className="w-full bg-gray-100 dark:bg-gray-800/30 border-none rounded-full py-3 pl-6 pr-24 text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background-light dark:focus:ring-offset-background-dark"
              placeholder="Suggest new branches or refine steps..."
              type="text"
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <div className="absolute inset-y-0 right-2 flex items-center space-x-1">
              <button className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50">
                <span className="material-icons-outlined">mic</span>
              </button>
              <button
                className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:opacity-90 transition-opacity"
                onClick={handleSendMessage}
              >
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
}
