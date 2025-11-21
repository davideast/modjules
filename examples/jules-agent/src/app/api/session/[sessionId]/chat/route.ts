import { Jules } from 'modjules';
import { NextResponse } from 'next/server';

export async function POST(
  req: Request,
  { params }: { params: { sessionId: string } },
) {
  const { message } = await req.json();
  const { sessionId } = params;

  if (!process.env.JULES_API_KEY) {
    return new Response('JULES_API_KEY is not set', { status: 500 });
  }

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  const jules = Jules({ apiKey: process.env.JULES_API_KEY });
  const session = jules.session(sessionId);
  const sessionInfo = await session.info();

  return NextResponse.json(sessionInfo);
}
