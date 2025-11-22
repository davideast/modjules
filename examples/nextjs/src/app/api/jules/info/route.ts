import { jules } from 'modjules';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const client = jules.with({ apiKey: process.env.JULES_API_KEY });
    const session = client.session(sessionId);
    const sessionInfo = await session.info();

    return NextResponse.json(sessionInfo);
  } catch (e: any) {
    console.error('API Error:', e);
    // Specifically handle cases where the session is not found.
    if (e.message.includes('404')) {
      return NextResponse.json(
        { error: `Session not found: ${e.message}` },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: e.message || 'An unknown error occurred' },
      { status: 500 },
    );
  }
}
