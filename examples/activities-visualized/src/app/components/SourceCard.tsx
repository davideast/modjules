import React from 'react';
import { Source } from 'modjules/types';

interface SourceCardProps {
  source: Source;
  title?: string;
  explanation?: React.ReactNode;
}

export const SourceCard = ({
  source,
  title = 'Source Details',
  explanation,
}: SourceCardProps) => {
  return (
    <div className="border-l-4 border-cyan-500 bg-white shadow-md rounded-lg p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <div className="text-sm text-gray-500">
          <span className="font-mono bg-gray-100 px-2 py-1 rounded">
            {source.type}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-gray-50 p-4 rounded border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Name
              </span>
              <p className="font-mono text-sm text-gray-800 break-all">
                {source.name}
              </p>
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                ID
              </span>
              <p className="font-mono text-sm text-gray-800 break-all">
                {source.id}
              </p>
            </div>
          </div>

          {source.type === 'githubRepo' && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                GitHub Repository
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <span className="text-xs text-gray-500">Owner</span>
                  <p className="font-medium text-gray-900">
                    {source.githubRepo.owner}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Repo</span>
                  <p className="font-medium text-gray-900">
                    {source.githubRepo.repo}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Visibility</span>
                  <p className="font-medium text-gray-900">
                    {source.githubRepo.isPrivate ? (
                      <span className="flex items-center text-amber-600">
                        <svg
                          className="w-4 h-4 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        </svg>
                        Private
                      </span>
                    ) : (
                      <span className="flex items-center text-green-600">
                        <svg
                          className="w-4 h-4 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Public
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {explanation && (
        <div className="mt-6 bg-cyan-50 p-4 rounded text-sm text-cyan-800">
          {explanation}
        </div>
      )}
    </div>
  );
};
