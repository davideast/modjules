import React from 'react';
import { SessionResource } from 'modjules/types';

interface SessionDetailProps {
  session: SessionResource;
  title?: string;
  explanation?: React.ReactNode;
}

export const SessionDetail = ({
  session,
  title,
  explanation,
}: SessionDetailProps) => {
  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
      <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-blue-900">
            {title || 'Session Object'}
          </h3>
          <p className="text-sm text-blue-700 mt-1">
            Type: <span className="font-mono font-bold">SessionResource</span>
          </p>
        </div>
        <div className="text-right">
          <span
            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold
                ${
                  session.state === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : session.state === 'failed'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                }`}
          >
            {session.state}
          </span>
        </div>
      </div>

      <div className="p-6">
        {explanation && (
          <div className="mb-6 bg-blue-50 text-blue-800 p-4 rounded-md text-sm border border-blue-100">
            {explanation}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">
              Prompt
            </h4>
            <p className="text-gray-800 bg-gray-50 p-3 rounded border border-gray-100">
              {session.prompt}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">
                Session ID
              </h4>
              <p className="font-mono text-gray-700 text-sm">{session.id}</p>
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">
                Source
              </h4>
              <p className="font-mono text-gray-700 text-sm break-all">
                {session.sourceContext.source}
              </p>
            </div>
          </div>

          {session.outputs.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">
                Outputs
              </h4>
              <div className="space-y-2">
                {session.outputs.map((output, idx) => {
                  if (output.type === 'pullRequest') {
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-sm text-gray-700 bg-green-50 p-2 rounded border border-green-100"
                      >
                        <span className="font-bold text-green-700">
                          Pull Request:
                        </span>
                        <a
                          href={output.pullRequest.url}
                          className="text-blue-600 hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {output.pullRequest.title}
                        </a>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100">
          <details className="group">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 flex items-center select-none">
              <span className="mr-2 transform group-open:rotate-90 transition-transform">
                ▶
              </span>
              View Raw JSON
            </summary>
            <pre className="mt-4 bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono">
              {JSON.stringify(session, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
};
