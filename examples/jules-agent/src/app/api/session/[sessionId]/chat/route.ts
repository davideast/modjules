import { Jules } from 'julets';
import { NextResponse } from 'next/server';

export async function POST(
  req: Request,
  { params }: { params: { sessionId: string } },
) {
  const { message } = await req.json();
  const { sessionId } = params;

  const jules = new Jules({
    apiKey: process.env.JULES_API_KEY,
  });

  await jules.sessions.chat(sessionId, {
    message: message,
  });

  return NextResponse.json({ success: true });
}
