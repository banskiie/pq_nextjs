import { NextResponse } from 'next/server';

// Serve an icon response at /favicon.ico to avoid browser 404s.
export function GET(request) {
  const iconUrl = new URL('/arrows.png', request.url);
  return NextResponse.redirect(iconUrl);
}
