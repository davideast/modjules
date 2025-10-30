import Chat from '@/components/chat';
import { Suspense } from 'react';

export default function Home() {
  return (
    <Suspense>
      <Chat />
    </Suspense>
  );
}
