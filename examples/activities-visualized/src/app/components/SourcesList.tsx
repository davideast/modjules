import React from 'react';
import { Source } from 'modjules/types';
import { SourceCard } from './SourceCard';

interface SourcesListProps {
  sources: Source[];
}

export const SourcesList = ({ sources }: SourcesListProps) => {
  return (
    <div className="space-y-6">
      <div className="bg-gray-800 text-gray-200 p-4 rounded-lg font-mono text-sm overflow-x-auto shadow-inner">
        <span className="text-purple-400">const</span> sources ={' '}
        <span className="text-purple-400">await</span> jules.sources();
        <br />
        <span className="text-purple-400">for await</span> (
        <span className="text-purple-400">const</span> source{' '}
        <span className="text-purple-400">of</span> sources) {'{'}
        <br />
        &nbsp;&nbsp;console.log(source.name);
        <br />
        {'}'}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {sources.map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            title={`Source: ${source.githubRepo.repo}`}
            explanation={
              <span>
                <strong>Listing Sources:</strong> When you iterate over{' '}
                <code className="bg-cyan-100 px-1 rounded">
                  jules.sources()
                </code>
                , the SDK yields <code>Source</code> objects like this one. It
                handles API pagination automatically.
              </span>
            }
          />
        ))}
      </div>
    </div>
  );
};
