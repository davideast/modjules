'use client';

import { useState, FormEvent, useRef, useEffect } from 'react';

// Define the structure of a chat message
interface Message {
  sender: 'user' | 'agent' | 'system';
  text: string;
}

export default function Home() {
  const [repo, setRepo] = useState<string>('davideast/julets');
  const [prompt, setPrompt] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Effect to scroll to the bottom of the chat history when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStartSession = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessages([]);

    try {
      const response = await fetch('/api/jules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', repo, prompt }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Failed to start session');
      }

      const { sessionId } = await response.json();
      setSessionId(sessionId);
      setMessages([
        {
          sender: 'system',
          text: `Session started for ${repo}. You can now ask questions.`,
        },
      ]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentMessage.trim() || !sessionId) return;

    const userMessage: Message = { sender: 'user', text: currentMessage };
    const thinkingMessage: Message = { sender: 'agent', text: 'Jules is thinking...' };

    setMessages((prev) => [...prev, userMessage, thinkingMessage]);
    setCurrentMessage('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/jules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          sessionId,
          message: currentMessage,
        }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Failed to send message');
      }

      const { reply } = await response.json();
      const agentReply: Message = { sender: 'agent', text: reply };

      // Replace "thinking..." message with the actual reply
      setMessages((prev) => [...prev.slice(0, -1), agentReply]);

    } catch (err: any) {
      const errorMessage: Message = { sender: 'system', text: `Error: ${err.message}` };
      // Replace "thinking..." message with the error
      setMessages((prev) => [...prev.slice(0, -1), errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const getSenderBgColor = (sender: Message['sender']) => {
    switch (sender) {
      case 'user':
        return 'bg-blue-600 text-white self-end';
      case 'agent':
        return 'bg-zinc-800 text-zinc-100 self-start';
      case 'system':
        return 'bg-zinc-800 text-yellow-400 self-center text-sm';
      default:
        return 'bg-zinc-800';
    }
  };

  return (
    <div className="flex flex-col h-screen font-sans">
      <header className="p-4 border-b border-zinc-800 bg-zinc-950 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-100">Julets Agent Chat</h1>
        <p className="text-sm text-zinc-400">Next.js Example</p>
      </header>

      <main className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden">
        {!sessionId ? (
          <div className="flex items-center justify-center h-full">
            <form
              onSubmit={handleStartSession}
              className="w-full max-w-md bg-zinc-900 border border-zinc-800 p-8 rounded-lg shadow-md"
            >
              <h2 className="text-xl font-semibold mb-4 text-center text-zinc-100">
                Start a New Session
              </h2>
              <div className="mb-4">
                <label htmlFor="repo" className="block text-sm font-medium text-zinc-400 mb-1">
                  GitHub Repository
                </label>
                <input
                  id="repo"
                  type="text"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-zinc-100 placeholder:text-zinc-500"
                  placeholder="e.g., davideast/julets"
                  disabled={isLoading}
                />
              </div>
              <div className="mb-4">
                <label
                  htmlFor="prompt"
                  className="block text-sm font-medium text-zinc-400 mb-1"
                >
                  Task Description
                </label>
                <textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-zinc-100 placeholder:text-zinc-500"
                  placeholder="Analyze this repository and identify 3 areas for refactoring."
                  rows={3}
                  disabled={isLoading}
                />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300"
                disabled={isLoading}
              >
                {isLoading ? 'Starting...' : 'Start Session'}
              </button>
              {error && <p className="mt-4 text-center text-red-500">{error}</p>}
            </form>
          </div>
        ) : (
          <div className="flex flex-col h-full bg-zinc-900 border border-zinc-800 rounded-lg shadow-md overflow-hidden">
            {/* Chat History */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              {messages.map((msg, index) => (
                <div key={index} className="flex flex-col">
                  <div
                    className={`max-w-xs md:max-w-md p-3 rounded-lg ${getSenderBgColor(
                      msg.sender
                    )}`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-950">
              {error && <p className="mb-2 text-center text-red-500 text-sm">{error}</p>}
              <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-zinc-100 placeholder:text-zinc-500"
                  placeholder="Ask a follow-up question..."
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  className="bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300"
                  disabled={isLoading || !currentMessage.trim()}
                >
                  {isLoading ? '...' : 'Send'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
