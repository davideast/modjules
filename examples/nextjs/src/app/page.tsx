'use client';

import { useState, useCallback, useEffect } from 'react';
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
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  const startStream = useCallback(
    (currentSessionId: string) => {
      if (eventSource) {
        eventSource.close();
      }

      const newEventSource = new EventSource(
        `/api/session/${currentSessionId}/stream`,
      );

      newEventSource.onmessage = (event) => {
        const activity = JSON.parse(event.data);
        setActivities((prev) => [...prev, activity]);
      };

      newEventSource.onerror = (err) => {
        console.error('EventSource failed:', err);
        const errorMessage: Activity = {
          type: 'agent.message',
          message: 'An error occurred while streaming.',
          originator: 'agent',
        };
        setActivities((prev) => [...prev, errorMessage]);
        newEventSource.close();
        setEventSource(null);
      };

      setEventSource(newEventSource);
    },
    [eventSource],
  );

  const createSession = async (prompt: string) => {
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          repo: 'jules-ai/jules-sdk-js-ci-cd-test', // Hardcoded for this example
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const { sessionId: newSessionId } = await response.json();
      setSessionId(newSessionId);
      startStream(newSessionId);
    } catch (error) {
      console.error('Session creation failed:', error);
      const errorMessage: Activity = {
        type: 'agent.message',
        message: 'Failed to create a new session.',
        originator: 'agent',
      };
      setActivities((prev) => [...prev, errorMessage]);
    }
  };

  const sendMessage = async (message: string) => {
    if (!sessionId) return;

    try {
      const response = await fetch(`/api/session/${sessionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Activity = {
        type: 'agent.message',
        message: 'Failed to send the message.',
        originator: 'agent',
      };
      setActivities((prev) => [...prev, errorMessage]);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim()) {
      const message = input;
      setActivities((prev) => [
        ...prev,
        { type: 'user.message', message, originator: 'user' },
      ]);
      setInput('');

      if (!sessionId) {
        createSession(message);
      } else {
        sendMessage(message);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [eventSource]);

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
