import { Jules, SessionClient } from 'modjules';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  const { sessionId } = params;

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID is required' },
      { status: 400 },
    );
  }

  try {
    const jules = Jules();
    const session: SessionClient = jules.session(sessionId);
    await session.approve();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error approving plan:', error);
    return NextResponse.json(
      { error: 'Failed to approve plan' },
      { status: 500 },
    );
  }
}
