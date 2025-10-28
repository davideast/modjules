'use client';

import { useState, useCallback } from 'react';
import { Activity } from 'julets';
import AgentChat from '../components/AgentChat';
import ChatMessage from '../components/ChatMessage';
import ExecutionPlan from '../components/ExecutionPlan';
import BashCommandOutput from '../components/BashCommandOutput';
import FileModified from '../components/FileModified';
import FrontendVerification from '../components/FrontendVerification';
import CommitSummary from '../components/CommitSummary';

export default function Home() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [input, setInput] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);

  const startStream = useCallback(
    async (prompt: string) => {
      setActivities((prev) => [
        ...prev,
        { type: 'user.message', message: prompt, originator: 'user' },
      ]);

      const url = sessionId
        ? `/api/stream?prompt=${encodeURIComponent(prompt)}&sessionId=${sessionId}`
        : `/api/stream?prompt=${encodeURIComponent(prompt)}`;

      const eventSource = new EventSource(url);

      eventSource.addEventListener('session_id', (event) => {
        const newSessionId = (event as MessageEvent).data;
        if (!sessionId) {
          setSessionId(newSessionId);
        }
      });

      eventSource.onmessage = (event) => {
        if (event.data === '[DONE]') {
          eventSource.close();
          return;
        }
        const activity = JSON.parse(event.data);
        setActivities((prev) => [...prev, activity]);
      };

      eventSource.onerror = (err) => {
        console.error('EventSource failed:', err);
        const errorMessage: Activity = {
          type: 'agent.message',
          message: 'An error occurred while streaming.',
          originator: 'agent',
        };
        setActivities((prev) => [...prev, errorMessage]);
        eventSource.close();
      };

      return () => {
        eventSource.close();
      };
    },
    [sessionId],
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>)' => {
    e.preventDefault();
    if (input.trim()) {
      startStream(input);
      setInput('');
    }
  };

  const renderActivity = (activity: Activity) => {
    // ... (renderActivity function remains the same)
  };

  return (
    <AgentChat
      input={input}
      onInputChange={(e) => setInput(e.target.value)}
      onSubmit={handleSubmit}
    >
      {activities.map((activity, index) => (
        <div key={index} className="flex justify-center">
          {renderActivity(activity)}
        </div>
      ))}
    </AgentChat>
  );
}
