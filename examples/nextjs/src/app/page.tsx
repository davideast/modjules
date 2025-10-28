'use client';

import { useState, useEffect, useCallback } from 'react';
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

  const startStream = useCallback(async (prompt: string) => {
    setActivities([
      { type: 'user.message', message: prompt, originator: 'user' },
    ]);

    const eventSource = new EventSource(
      `/api/stream?prompt=${encodeURIComponent(prompt)}`,
    );

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
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim()) {
      startStream(input);
      setInput('');
    }
  };

  const renderActivity = (activity: Activity) => {
    switch (activity.type) {
      case 'user.message':
        return <ChatMessage originator="user" message={activity.message} />;
      case 'agent.message':
        return <ChatMessage originator="agent" message={activity.message} />;
      case 'agent.plan':
        return (
          <ExecutionPlan
            steps={activity.plan.steps.map((s) => s.description)}
          />
        );
      case 'agent.bash':
        return (
          <BashCommandOutput
            command={activity.bash.command}
            output={activity.bash.output}
          />
        );
      case 'agent.file':
        return (
          <FileModified
            filePath={activity.file.path}
            description={`Modified ${activity.file.path}`}
            repo={activity.source?.github?.repo || ''}
          />
        );
      case 'agent.frontend':
        const imageUrl = activity.frontend?.media?.[0]?.url || '';
        const altText =
          activity.frontend?.media?.[0]?.alt ||
          'Frontend Verification Screenshot';
        return <FrontendVerification imageUrl={imageUrl} altText={altText} />;
      case 'agent.commit':
        return <CommitSummary commitMessage={activity.commit.message} />;
      default:
        return (
          <pre className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap">
            {JSON.stringify(activity, null, 2)}
          </pre>
        );
    }
  };

  return (
    <main className="bg-background-light dark:bg-background-dark font-sans antialiased">
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
    </main>
  );
}
