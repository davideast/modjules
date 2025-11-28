import React from 'react';
import { SessionResource } from 'modjules/types';
import { SessionDetail } from './SessionDetail';

interface SessionListProps {
  sessions: SessionResource[];
}

export const SessionList = ({ sessions }: SessionListProps) => {
  return (
    <div className="space-y-6">
      <div className="bg-gray-800 text-gray-200 p-4 rounded-lg font-mono text-sm overflow-x-auto shadow-inner">
        <span className="text-purple-400">const</span> sessions ={' '}
        <span className="text-purple-400">await</span> jules.sessions();
        <br />
        <span className="text-purple-400">for await</span> (
        <span className="text-purple-400">const</span> session{' '}
        <span className="text-purple-400">of</span> sessions) {'{'}
        <br />
        &nbsp;&nbsp;console.log(session.title);
        <br />
        {'}'}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {sessions.map((session) => (
          <SessionDetail
            key={session.id}
            session={session}
            title={`Session: ${session.title}`}
            explanation={
              <span>
                <strong>Listing Sessions:</strong> When you call{' '}
                <code className="bg-cyan-100 px-1 rounded">
                  jules.sessions()
                </code>
                , it returns a <code>SessionCursor</code> which is an async
                iterable. It yields <code>SessionResource</code> objects like
                this one, handling pagination automatically.
              </span>
            }
          />
        ))}
      </div>
    </div>
  );
};
