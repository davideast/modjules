import { Jules } from 'julets';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return new Response('Missing sessionId', { status: 400 });
  }

  const jules = Jules();
  const session = jules.session(sessionId as string);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const activity of session.stream()) {
          const chunk = `data: ${JSON.stringify(activity)}\n\n`;
          controller.enqueue(new TextEncoder().encode(chunk));
        }
      } catch (e) {
        console.error('Stream error:', e);
        const chunk = `data: ${JSON.stringify({
          type: 'error',
          error: (e as any).message,
        })}\n\n`;
        controller.enqueue(new TextEncoder().encode(chunk));
      } finally {
        console.log('Closing stream');
        controller.close();
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
