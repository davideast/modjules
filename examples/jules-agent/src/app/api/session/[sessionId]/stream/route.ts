import { NextResponse } from 'next/server';
import { Jules } from 'julets';

export async function GET(
  req: Request,
  { params }: { params: { sessionId: string } },
) {
  const { sessionId } = params;

  if (!process.env.JULES_API_KEY) {
    return new Response('JULES_API_KEY is not set', { status: 500 });
  }

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  const jules = Jules({
    apiKey: process.env.JULES_API_KEY,
  });

  const stream = new ReadableStream({
    async start(controller) {
      const session = await jules.session(sessionId);

      for await (const activity of session.stream()) {
        const chunk = `data: ${JSON.stringify(activity)}\n\n`;
        controller.enqueue(new TextEncoder().encode(chunk));
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
