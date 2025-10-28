import { Jules } from 'julets';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  try {
    const { message } = await req.json();
    const { sessionId } = params;

    if (!sessionId || !message) {
      return NextResponse.json(
        { error: 'Session ID and message are required' },
        { status: 400 },
      );
    }

    const jules = Jules({ apiKey: process.env.JULES_API_KEY });
    const session = jules.session(sessionId);
    await session.ask(message);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('API Error:', e);
    return NextResponse.json(
      { error: e.message || 'An unknown error occurred' },
      { status: 500 },
    );
  }
}
