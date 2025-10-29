import { Jules } from 'julets';
import { NextResponse } from 'next/server';

export async function POST() {
  const jules = new Jules({
    apiKey: process.env.JULES_API_KEY,
  });

  const session = await jules.sessions.create({
    title: 'Jules Agent Example',
    description: 'A new chat session with the Jules agent.',
  });

  return NextResponse.json({ sessionId: session.id });
}
