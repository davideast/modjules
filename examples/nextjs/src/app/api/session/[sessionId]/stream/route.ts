import { Jules } from 'julets';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  const { sessionId } = params;

  if (!sessionId) {
    return new Response('Missing session ID', { status: 400 });
  }

  const jules = Jules({ apiKey: process.env.JULES_API_KEY });
  const session = jules.session(sessionId);

  const stream = new ReadableStream({
    async start(controller) {
      for await (const activity of session.stream()) {
        const chunk = `data: ${JSON.stringify(activity)}\n\n`;
        controller.enqueue(new TextEncoder().encode(chunk));
      }

      controller.close();
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
