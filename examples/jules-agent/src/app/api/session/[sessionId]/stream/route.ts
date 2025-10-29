import { Jules } from 'julets';

export async function GET(
  req: Request,
  { params }: { params: { sessionId: string } },
) {
  const { sessionId } = params;

  const jules = new Jules({
    apiKey: process.env.JULES_API_KEY,
  });

  const stream = new ReadableStream({
    async start(controller) {
      const activityStream = await jules.sessions.stream(sessionId, {});

      for await (const activity of activityStream) {
        const chunk = `data: ${JSON.stringify(activity)}\n\n`;
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      // The stream from jules.sessions.stream is non-terminating,
      // so we don't call controller.close() here.
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
