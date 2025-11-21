'use client';

import {
  useState,
  FormEvent,
  useRef,
  useEffect,
  useCallback,
  Suspense,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Activity } from 'modjules';

// Define the structure of a chat message
interface Message {
  sender: 'user' | 'agent' | 'system';
  text: string;
  activity?: Activity; // Optional: Store the original activity for rich rendering
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-zinc-950 text-zinc-100">
          Loading...
        </div>
      }
    >
      <Chat />
    </Suspense>
  );
}

function Chat() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [repo, setRepo] = useState<string>('davideast/modjules');
  const [prompt, setPrompt] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(true);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Effect to scroll to the bottom of the chat history when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const connectToStream = useCallback((sessionId: string) => {
    // On reconnect, clear previous messages and errors, but keep the initial prompt.
    setMessages((prev) =>
      prev.length > 0 && prev[0].sender === 'user' ? [prev[0]] : [],
    );
    setError(null);
    setIsConnected(true);

    const eventSource = new EventSource(
      `/api/jules/stream?sessionId=${sessionId}`,
    );

    eventSource.onmessage = (event) => {
      setError(null); // Clear any previous error on receiving data
      setIsConnected(true);
      const data = JSON.parse(event.data);

      if (data.type === 'error') {
        const errorMessage: Message = {
          sender: 'system',
          text: `Stream Error: ${data.error}`,
        };
        setMessages((prev) => [...prev, errorMessage]);
        eventSource.close();
        return;
      }

      const activity = data as Activity;
      let message: Message | null = null;

      switch (activity.type) {
        case 'agentMessaged':
          message = { sender: 'agent', text: activity.message, activity };
          break;
        case 'planGenerated':
          message = { sender: 'system', text: '', activity: activity };
          break;
        case 'planApproved':
          message = { sender: 'system', text: `✅ Plan approved.`, activity };
          break;
        case 'progressUpdated':
          message = {
            sender: 'system',
            text: `⚙️ ${activity.title}`,
            activity,
          };
          break;
        case 'sessionCompleted':
          message = {
            sender: 'system',
            text: `Completed ${activity.name}`,
            activity,
          };
          break;
        default:
          message = { sender: 'system', text: 'Unknown activity', activity };
          break;
      }

      if (message) {
        setMessages((prev) => [...prev, message!]);
      }
    };

    eventSource.onerror = (err) => {
      console.error('EventSource failed:', err);
      setError('Connection to agent stream lost.');
      setIsConnected(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    const sessionFromUrl = searchParams.get('session');
    if (sessionFromUrl && sessionFromUrl !== sessionId) {
      const rehydrate = async () => {
        setIsLoading(true);
        setError(null);
        setMessages([]);
        setSessionId(sessionFromUrl);

        try {
          const response = await fetch(
            `/api/jules/info?sessionId=${sessionFromUrl}`,
          );
          if (!response.ok) {
            const { error } = await response.json();
            throw new Error(error);
          }
          const sessionInfo = await response.json();
          if (sessionInfo.prompt) {
            setMessages([{ sender: 'user', text: sessionInfo.prompt }]);
          }
          connectToStream(sessionFromUrl);
        } catch (err: any) {
          setError(`Failed to resume session: ${err.message}`);
          setSessionId(null);
          router.push('/');
        } finally {
          setIsLoading(false);
        }
      };
      rehydrate();
    }
  }, [searchParams, sessionId, connectToStream, router]);

  const handleStartSession = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessages([{ sender: 'user', text: prompt }]);

    try {
      const response = await fetch('/api/jules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', repo, prompt }),
      });
      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error);
      }
      const { sessionId } = await response.json();
      setSessionId(sessionId);
      router.push(`/?session=${sessionId}`);
      connectToStream(sessionId);
    } catch (err: any) {
      setError(err.message);
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentMessage.trim() || !sessionId) return;
    setMessages((prev) => [...prev, { sender: 'user', text: currentMessage }]);
    const messageToSend = currentMessage;
    setCurrentMessage('');
    setError(null);

    try {
      const response = await fetch('/api/jules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          sessionId,
          message: messageToSend,
        }),
      });
      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { sender: 'system', text: `Error: ${err.message}` },
      ]);
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
                <label
                  htmlFor="repo"
                  className="block text-sm font-medium text-zinc-400 mb-1"
                >
                  GitHub Repository
                </label>
                <input
                  id="repo"
                  type="text"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-zinc-100 placeholder:text-zinc-500"
                  placeholder="e.g., davideast/modjules"
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
              {error && (
                <p className="mt-4 text-center text-red-500">{error}</p>
              )}
            </form>
          </div>
        ) : (
          <div className="flex flex-col h-full bg-zinc-900 border border-zinc-800 rounded-lg shadow-md overflow-hidden">
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              {messages.map((msg, index) => (
                <div key={index} className="flex flex-col">
                  <div
                    className={`max-w-xs md:max-w-md p-3 rounded-lg ${getSenderBgColor(
                      msg.sender,
                    )}`}
                  >
                    {msg.activity?.type === 'planGenerated' ? (
                      <div className="text-zinc-100">
                        <p className="font-semibold mb-2">
                          Okay, here is my plan:
                        </p>
                        <ul className="list-disc list-inside space-y-1">
                          {msg.activity.plan.steps.map((step) => (
                            <li key={step.id}>{step.title}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p>{msg.text}</p>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t border-zinc-800 bg-zinc-950">
              {error && (
                <p className="mb-2 text-center text-red-500 text-sm">{error}</p>
              )}
              {!isConnected && sessionId && (
                <div className="mb-2 text-center">
                  <button
                    onClick={() => connectToStream(sessionId)}
                    className="bg-yellow-500 text-black py-2 px-4 rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400"
                  >
                    Reconnect
                  </button>
                </div>
              )}
              <form
                onSubmit={handleSendMessage}
                className="flex items-center space-x-2"
              >
                <input
                  type="text"
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-zinc-100 placeholder:text-zinc-500"
                  placeholder="Ask a follow-up question..."
                  disabled={isLoading || !isConnected}
                />
                <button
                  type="submit"
                  className="bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300"
                  disabled={isLoading || !isConnected || !currentMessage.trim()}
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
