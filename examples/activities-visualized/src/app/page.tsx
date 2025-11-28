import { activities, mockSessionResource } from './data';
import { sources } from './sources-data';
import { ActivityCard } from './components/ActivityCard';
import { SourcesList } from './components/SourcesList';
import { SourceCard } from './components/SourceCard';
import { SessionList } from './components/SessionList';
import { SessionDetail } from './components/SessionDetail';

export default function Home() {
  const singleSource = sources[0];

  return (
    <main className="min-h-screen p-8 md:p-24 max-w-4xl mx-auto">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Modjules Visualization
        </h1>
        <p className="text-lg text-gray-600">
          A visual guide to the data structures in the Modjules SDK, including
          Activities, Sources, and Sessions.
        </p>
      </header>

      <section className="mb-20">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">
          Activity Stream
        </h2>
        <p className="text-gray-600 mb-8">
          Activities represent events in a session&apos;s lifecycle. The cards
          below show how different activities are structured and what they mean.
        </p>
        <div className="space-y-8">
          {activities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      </section>

      <section className="mb-20">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">
          Listing Sessions
        </h2>
        <p className="text-gray-600 mb-8">
          The <code className="bg-gray-100 px-1 rounded">jules.sessions()</code>{' '}
          method returns a cursor (async iterable) of past sessions.
        </p>
        <SessionList sessions={[mockSessionResource]} />
      </section>

      <section className="mb-20">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">
          Getting a Single Session
        </h2>
        <p className="text-gray-600 mb-8">
          You can retrieve a specific session by its ID using{' '}
          <code className="bg-gray-100 px-1 rounded">
            jules.session(&apos;ID&apos;).info()
          </code>
          .
        </p>

        <div className="bg-gray-800 text-gray-200 p-4 rounded-lg font-mono text-sm overflow-x-auto shadow-inner mb-6">
          <span className="text-purple-400">const</span> session =
          jules.session( &apos;{mockSessionResource.id}&apos;);
          <br />
          <span className="text-purple-400">const</span> info ={' '}
          <span className="text-purple-400">await</span> session.info();
        </div>

        <SessionDetail
          session={mockSessionResource}
          title="Single Session Info"
          explanation={
            <span>
              <strong>Session Info:</strong> The <code>info()</code> method
              returns the full <code>SessionResource</code> object, which
              contains metadata about the session, including its current state,
              original prompt, and any outputs like Pull Requests.
            </span>
          }
        />
      </section>

      <section className="mb-20">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">
          Listing Sources
        </h2>
        <p className="text-gray-600 mb-8">
          The <code className="bg-gray-100 px-1 rounded">jules.sources()</code>{' '}
          method returns an async iterable of all connected sources.
        </p>
        <SourcesList sources={sources} />
      </section>

      <section className="mb-20">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">
          Getting a Single Source
        </h2>
        <p className="text-gray-600 mb-8">
          You can retrieve a specific source using{' '}
          <code className="bg-gray-100 px-1 rounded">jules.sources.get()</code>.
        </p>

        <div className="bg-gray-800 text-gray-200 p-4 rounded-lg font-mono text-sm overflow-x-auto shadow-inner mb-6">
          <span className="text-purple-400">const</span> source ={' '}
          <span className="text-purple-400">await</span> jules.sources.get(
          {'{'} github: &apos;{singleSource.githubRepo.owner}/
          {singleSource.githubRepo.repo}&apos; {'}'});
        </div>

        <SourceCard
          source={singleSource}
          title="Single Source Result"
          explanation={
            <span>
              <strong>Direct Retrieval:</strong> This method is useful when you
              know the specific repository you want to work with and need its
              full <code>Source</code> object (e.g., to get its ID).
            </span>
          }
        />
      </section>

      <footer className="mt-20 text-center text-gray-500 text-sm border-t pt-8">
        <p>Built with Next.js and Tailwind CSS</p>
      </footer>
    </main>
  );
}
