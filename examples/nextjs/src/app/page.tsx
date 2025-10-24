'use client';

import { useState, FormEvent, useRef, useEffect } from 'react';
import { streamFlow } from '@genkit-ai/next/client';
import ReactMarkdown from 'react-markdown';

// Define the structure of a chat message
interface Message {
  sender: 'user' | 'agent';
  text: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Effect to scroll to the bottom of the chat history when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentMessage.trim()) return;

    const userMessage: Message = { sender: 'user', text: currentMessage };
    setMessages((prev) => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);
    setError(null);

    try {
      const { stream } = streamFlow({ url: '/api/genkit', input: { message: currentMessage } });

      let agentResponse = '';
      for await (const chunk of stream) {
        agentResponse += chunk;
        // Update the last message (the agent's) in the array as it streams in
        setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage?.sender === 'agent') {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = { ...lastMessage, text: agentResponse };
                return newMessages;
            }
            return [...prev, { sender: 'agent', text: agentResponse }];
        });
      }

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      setMessages((prev) => [...prev, { sender: 'agent', text: `Error: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const getSenderBgColor = (sender: Message['sender']) => {
    switch (sender) {
      case 'user':
        return 'bg-blue-500 text-white self-end';
      case 'agent':
        return 'bg-gray-200 text-gray-800 self-start';
      default:
        return 'bg-gray-100';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      <header className="p-4 border-b bg-white shadow-sm">
        <h1 className="text-2xl font-bold text-gray-800">Genkit Supervisor Chat</h1>
        <p className="text-sm text-gray-500">Next.js Example</p>
      </header>

      <main className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden">
          <div className="flex flex-col h-full bg-white rounded-lg shadow-md overflow-hidden">
            {/* Chat History */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              {messages.map((msg, index) => (
                <div key={index} className="flex flex-col">
                  <div
                    className={`max-w-xs md:max-w-md p-3 rounded-lg ${getSenderBgColor(msg.sender)}`}
                  >
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t bg-gray-50">
              {error && <p className="mb-2 text-center text-red-500 text-sm">{error}</p>}
              <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Ask the supervisor to do something..."
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
      </main>
    </div>
  );
}
