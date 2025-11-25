import { activities } from './data';
import { ActivityCard } from './components/ActivityCard';

export default function Home() {
  return (
    <main className="min-h-screen p-8 md:p-24 max-w-4xl mx-auto">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Modjules Activity Visualization
        </h1>
        <p className="text-lg text-gray-600">
          A visual guide to the different activity types in the Modjules SDK.
          Each card below represents a real activity object and explains its purpose.
        </p>
      </header>

      <div className="space-y-8">
        {activities.map((activity) => (
          <ActivityCard key={activity.id} activity={activity} />
        ))}
      </div>

      <footer className="mt-20 text-center text-gray-500 text-sm">
        <p>Built with Next.js and Tailwind CSS</p>
      </footer>
    </main>
  );
}
