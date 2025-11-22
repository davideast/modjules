import { jules } from 'modjules';
import { NextResponse } from 'next/server';

export async function POST() {
  if (!process.env.JULES_API_KEY) {
    return new Response('JULES_API_KEY is not set', { status: 500 });
  }

  const client = jules.with({
    apiKey: process.env.JULES_API_KEY,
  });

  // Updated to match the SessionConfig interface
  const session = await client.session({
    prompt: 'A new chat session with the Jules agent.',
    source: {
      github: 'davideast/modjules', // Defaulting to the library repo for the example
      branch: 'main',
    },
    title: 'Jules Agent Example',
  });

  return NextResponse.json({ sessionId: session.id });
}
