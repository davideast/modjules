import { Jules } from 'julets';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const prompt = req.nextUrl.searchParams.get('prompt');

  if (!prompt) {
    return new Response('Missing prompt', { status: 400 });
  }

  const jules = Jules();
  const session = jules.run({ prompt });

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
