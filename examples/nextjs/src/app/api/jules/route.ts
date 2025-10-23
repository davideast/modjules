import { Jules } from 'julets';
import { NextResponse } from 'next/server';

// Simple route to verify import and initialization work in Next.js runtime
export async function GET() {
try {
const jules = Jules(); // Just initialize, don't need to call anything yet
return NextResponse.json({ ok: true });
} catch (e: any) {
return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
}
}
