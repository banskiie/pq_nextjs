import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Player from '@/lib/models/Player';
import pusherServer from '@/lib/pusher';
import { PUSHER_CHANNEL, PUSHER_EVENTS } from '@/lib/pusherEvents';

export async function POST(req) {
  try {
    await connectDB();
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ ok: false, message: 'No file provided' }, { status: 400 });
    }

    const text = await file.text();
    const lines = text
      .split('\n')
      .map((line) =>
        line
          .replace(/^\s*(?:\d+\s*[.)\-:]\s*|\d+\s+|[-*•]+\s*)/, '')
          .trim()
      )
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return NextResponse.json({ ok: false, message: 'No valid player names found in file' }, { status: 400 });
    }

    let added = 0;
    let skipped = 0;
    const createdPlayers = [];

    for (const name of lines) {
      const existing = await Player.findOne({
        name: { $regex: `^${name}$`, $options: 'i' },
        isDeleted: { $ne: true },
      }).lean();

      if (existing) {
        skipped++;
        continue;
      }

      const player = await Player.create({ name });
      createdPlayers.push(player);
      added++;
    }

    for (const player of createdPlayers) {
      const doc = player.toObject();
      doc._id = String(doc._id);
      await pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENTS.PLAYER, { type: 'CREATED', player: doc });
    }

    return NextResponse.json({ ok: true, added, skipped });
  } catch (err) {
    console.error('Upload players error:', err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
