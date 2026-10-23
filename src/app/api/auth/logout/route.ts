import { NextResponse, type NextRequest } from 'next/server';
import { clearSession } from '@/server/session';

export async function POST(request: NextRequest) {
  await clearSession();
  // 303: POST 이후 GET으로 이동시킨다.
  return NextResponse.redirect(new URL('/', request.url), 303);
}
