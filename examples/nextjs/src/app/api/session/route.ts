import { Jules } from 'julets';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Note: This is a simplified handler for demonstration purposes.
 * In a real-world application, you would want to manage the Jules client
 * instance more robustly (e.g., as a singleton) and handle sessions
 * securely, likely associating them with authenticated user identities.
 */
export async function POST(req: NextRequest) {
  try {
    const { repo, prompt } = await req.json();

    // For simplicity, we initialize the client on each request.
    // In a production app, you'd likely initialize this once.
    const jules = Jules({ apiKey: process.env.JULES_API_KEY });

    if (!repo) {
      return NextResponse.json(
        { error: 'GitHub repo is required' },
        { status: 400 },
      );
    }
    if (!prompt) {
      return NextResponse.json(
        { error: 'Task description is required' },
        { status: 400 },
      );
    }
    console.log(`Starting session for repo: ${repo}`);
    console.log(`Starting session with prompt: ${prompt}`);
    const session = await jules.session({
      prompt,
      source: {
        github: repo,
        branch: 'main', // Assume a default branch for this example
      },
    });
    console.log(`Session started: ${session.id}`);
    return NextResponse.json({ sessionId: session.id });
  } catch (e: any) {
    console.error('API Error:', e);
    return NextResponse.json(
      { error: e.message || 'An unknown error occurred' },
      { status: 500 },
    );
  }
}
