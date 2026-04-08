import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Player from '@/lib/models/Player';
import pusherServer from '@/lib/pusher';
import { PUSHER_CHANNEL, PUSHER_EVENTS } from '@/lib/pusherEvents';

export async function POST(req) {
  try {
    await connectDB();
    const body = await req.json();
    const { players: names } = body;

    if (!Array.isArray(names) || names.length === 0) {
      return NextResponse.json({ ok: false, message: 'No player names provided' }, { status: 400 });
    }

    let added = 0;
    let skipped = 0;
    const createdPlayers = [];

    for (const rawName of names) {
      const name = String(rawName).trim();
      if (!name) continue;

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
    console.error('Bulk add players error:', err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
