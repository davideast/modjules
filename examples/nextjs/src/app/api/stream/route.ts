import { Jules } from 'julets';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const prompt = req.nextUrl.searchParams.get('prompt');
  const sessionId = req.nextUrl.searchParams.get('sessionId');

  if (!prompt) {
    return new Response('Missing prompt', { status: 400 });
  }

  const jules = Jules();
  const session = jules.run({
    prompt,
    sessionId: sessionId ?? undefined,
  });

  const stream = new ReadableStream({
    async start(controller) {
      // Send the session ID as a custom event at the start of the stream.
      // The client will listen for this event to get the session ID.
      // This assumes the `session` object returned by `jules.run` has an `id` property.
      const idChunk = `event: session_id\ndata: ${session.id}\n\n`;
      controller.enqueue(new TextEncoder().encode(idChunk));

      for await (const activity of session.stream()) {
        const chunk = `data: ${JSON.stringify(activity)}\n\n`;
        controller.enqueue(new TextEncoder().encode(chunk));
      }

      // The client expects a [DONE] message to know when to close the connection.
      const doneChunk = `data: [DONE]\n\n`;
      controller.enqueue(new TextEncoder().encode(doneChunk));

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
