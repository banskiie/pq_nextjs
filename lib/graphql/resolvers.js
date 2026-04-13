import { connectDB } from '@/lib/db';
import Session from '@/lib/models/Session';
import Player from '@/lib/models/Player';
import Court from '@/lib/models/Court';
import Match from '@/lib/models/Match';
import Game from '@/lib/models/Game';
import Payment from '@/lib/models/Payment';
import pusherServer from '@/lib/pusher';
import { PUSHER_CHANNEL, PUSHER_EVENTS } from '@/lib/pusherEvents';
import mongoose from 'mongoose';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toDoc = (doc) => {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  obj._id = String(obj._id);
  if (obj.sessionId) obj.sessionId = String(obj.sessionId);
  if (obj.courtId) obj.courtId = String(obj.courtId);
  if (obj.playerIds) obj.playerIds = obj.playerIds.map(String);
  if (obj.players && Array.isArray(obj.players)) {
    obj.players = obj.players.map((p) => {
      // Session / Payment: subdocument objects that have a playerId field
      if (p !== null && typeof p === 'object' && 'playerId' in p) {
        return { ...p, playerId: p.playerId != null ? String(p.playerId) : p.playerId };
      }
      // Game: plain array of ObjectId scalars — just stringify
      return String(p);
    });
  }
  if (obj.courts) obj.courts = obj.courts.map(String);
  if (obj.winnerPlayerIds) obj.winnerPlayerIds = obj.winnerPlayerIds.map(String);
  if (obj.gamesBySession) obj.gamesBySession = obj.gamesBySession.map(String);
  return obj;
};

const recalcWinRate = (winCount, playCount) =>
  playCount > 0 ? Math.round((winCount / playCount) * 10000) / 100 : 0;

const findActiveMatchOnCourt = async (courtId, excludeMatchId = null) => {
  if (!courtId) return null;
  const query = { courtId, queued: false };
  if (excludeMatchId) {
    query._id = { $ne: excludeMatchId };
  }
  return Match.findOne(query).lean();
};

const findPlayerConflictsInActiveMatches = async (playerIds, excludeMatchId = null) => {
  if (!Array.isArray(playerIds) || playerIds.length === 0) return [];

  const requestedIds = [...new Set(playerIds.map(String))];
  const query = { playerIds: { $in: requestedIds } };
  if (excludeMatchId) {
    query._id = { $ne: excludeMatchId };
  }

  const conflictingMatches = await Match.find(query).select('playerIds').lean();
  if (conflictingMatches.length === 0) return [];

  const conflictingPlayerIds = new Set();
  for (const match of conflictingMatches) {
    const ids = Array.isArray(match?.playerIds) ? match.playerIds.map(String) : [];
    ids.forEach((id) => {
      if (requestedIds.includes(id)) {
        conflictingPlayerIds.add(id);
      }
    });
  }

  if (conflictingPlayerIds.size === 0) return [];

  const players = await Player.find({ _id: { $in: [...conflictingPlayerIds] } })
    .select('name')
    .lean();
  const playerNameById = new Map(players.map((player) => [String(player._id), player.name]));

  return [...conflictingPlayerIds].map((id) => playerNameById.get(id) || id);
};

const isDuplicateKeyError = (error) => error?.code === 11000;

// ─── Resolvers ───────────────────────────────────────────────────────────────

const resolvers = {
  Query: {
    sessions: async () => {
      await connectDB();
      const sessions = await Session.find({ isArchived: false }).lean();
      return sessions.map(toDoc);
    },

    session: async (_, { id }) => {
      await connectDB();
      const session = await Session.findById(id).lean();
      return toDoc(session);
    },

    closedSessions: async () => {
      await connectDB();
      const sessions = await Session.find({ status: 'CLOSED' }).lean();
      return sessions.map(toDoc);
    },

    ongoingMatches: async () => {
      await connectDB();
      const matches = await Match.find({}).lean();
      return matches.map(toDoc);
    },

    courts: async () => {
      await connectDB();
      const courts = await Court.find({}).lean();
      return courts.map(toDoc);
    },

    players: async () => {
      await connectDB();
      const players = await Player.find({ isDeleted: { $ne: true } }).lean();
      return players.map(toDoc);
    },

    playersPaginated: async (_, { limit, offset, search, skillLevel, sortBy, sortOrder }) => {
      await connectDB();
      const filter = { isDeleted: { $ne: true } };
      if (search) filter.name = { $regex: search, $options: 'i' };
      if (skillLevel) filter.playerLevel = skillLevel;

      const sortField = sortBy || 'createdAt';
      const sortDir = sortOrder === 'asc' ? 1 : -1;

      const [players, total] = await Promise.all([
        Player.find(filter).sort({ [sortField]: sortDir }).skip(offset).limit(limit).lean(),
        Player.countDocuments(filter),
      ]);
      return { players: players.map(toDoc), total };
    },

    playersCount: async (_, { search, skillLevel }) => {
      await connectDB();
      const filter = { isDeleted: { $ne: true } };
      if (search) filter.name = { $regex: search, $options: 'i' };
      if (skillLevel) filter.playerLevel = skillLevel;
      return Player.countDocuments(filter);
    },

    deletedPlayers: async () => {
      await connectDB();
      const players = await Player.find({ isDeleted: true }).lean();
      return players.map(toDoc);
    },

    gamesBySession: async (_, { sessionId }) => {
      await connectDB();
      const games = await Game.find({ sessionId }).lean();
      return games.map(toDoc);
    },

    gamesBySessionIds: async (_, { sessionIds }) => {
      await connectDB();
      const games = await Game.find({ sessionId: { $in: sessionIds } }).lean();
      return games.map(toDoc);
    },

    paymentsHistory: async () => {
      await connectDB();
      const payments = await Payment.find({}).sort({ createdAt: -1 }).lean();
      return { ok: true, payments: payments.map(toDoc) };
    },

    billingBySession: async (_, { sessionId }) => {
      await connectDB();
      const payment = await Payment.findOne({ sessionId }).lean();
      if (!payment) return { ok: false, message: 'Payment not found', payment: null };
      return { ok: true, payment: toDoc(payment) };
    },
  },

  Mutation: {
    // ─── Session ─────────────────────────────────────────────────────────────

    createSession: async (_, { input }) => {
      await connectDB();
      const session = await Session.create({
        name: input.name,
        courts: input.courtIds || [],
        players: (input.playerIds || []).map((id) => ({ playerId: id, gamesPlayed: 0 })),
        price: input.price ?? null,
        status: 'QUEUED',
      });
      const doc = toDoc(session);
      await pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENTS.SESSION, { type: 'CREATED', session: doc });
      return { ok: true, session: doc };
    },

    updateSession: async (_, { id, input }) => {
      await connectDB();
      const update = {};
      if (input.name !== undefined) update.name = input.name;
      if (input.courtIds !== undefined) update.courts = input.courtIds;
      if (input.price !== undefined) update.price = input.price;
      if (input.playerIds !== undefined) {
        const session = await Session.findById(id).lean();
        const existingMap = new Map(
          (session.players || []).map((p) => [String(p.playerId), p.gamesPlayed])
        );
        update.players = input.playerIds.map((pid) => ({
          playerId: pid,
          gamesPlayed: existingMap.get(String(pid)) ?? 0,
        }));
      }
      const session = await Session.findByIdAndUpdate(id, update, { new: true }).lean();
      if (!session) return { ok: false, message: 'Session not found' };
      const doc = toDoc(session);
      await pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENTS.SESSION, { type: 'UPDATED', session: doc });
      return { ok: true, session: doc };
    },

    startSession: async (_, { id }) => {
      await connectDB();
      const session = await Session.findByIdAndUpdate(
        id,
        { status: 'OPEN', startedAt: new Date() },
        { new: true }
      ).lean();
      if (!session) return { ok: false, message: 'Session not found' };
      const doc = toDoc(session);
      await pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENTS.SESSION, { type: 'STARTED', session: doc });
      return { ok: true, session: doc };
    },

    endSession: async (_, { id }) => {
      await connectDB();
      const session = await Session.findById(id).lean();
      if (!session) return { ok: false, message: 'Session not found' };

      const endedAt = new Date();
      const updatedSession = await Session.findByIdAndUpdate(
        id,
        { status: 'CLOSED', endedAt },
        { new: true }
      ).lean();

      // Create payment record if price is set
      if (session.price && session.price > 0) {
        const sessionPlayers = session.players || [];
        const paymentPlayers = sessionPlayers.map((sp) => ({
          playerId: sp.playerId,
          gamesPlayed: sp.gamesPlayed,
          total: sp.gamesPlayed * session.price,
          status: 'UNPAID',
        }));
        const totalRevenue = paymentPlayers.reduce((sum, p) => sum + p.total, 0);
        const payment = await Payment.create({
          sessionId: id,
          pricePerGame: session.price,
          totalRevenue,
          closedAt: endedAt,
          players: paymentPlayers,
        });
        const paymentDoc = toDoc(payment);
        await pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENTS.PAYMENT, { type: 'CREATED', payment: paymentDoc });
      }

      const doc = toDoc(updatedSession);
      await pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENTS.SESSION, { type: 'ENDED', session: doc });
      return { ok: true, session: doc };
    },

    archiveSession: async (_, { id }) => {
      await connectDB();
      const session = await Session.findByIdAndUpdate(id, { isArchived: true }, { new: true }).lean();
      if (!session) return { ok: false, message: 'Session not found' };
      const doc = toDoc(session);
      await pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENTS.SESSION, { type: 'ARCHIVED', session: doc });
      return { ok: true, session: doc };
    },

    addPlayersToSession: async (_, { id, input }) => {
      await connectDB();
      const session = await Session.findById(id).lean();
      if (!session) return { ok: false, message: 'Session not found' };

      const existingIds = new Set((session.players || []).map((p) => String(p.playerId)));
      const newEntries = input.playerIds
        .filter((pid) => !existingIds.has(String(pid)))
        .map((pid) => ({ playerId: pid, gamesPlayed: 0 }));

      const updated = await Session.findByIdAndUpdate(
        id,
        { $push: { players: { $each: newEntries } } },
        { new: true }
      ).lean();
      const doc = toDoc(updated);
      await pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENTS.SESSION, { type: 'UPDATED', session: doc });
      return { ok: true, session: doc };
    },

    removePlayerFromSessions: async (_, { playerId, sessionIds, isExempted }) => {
      await connectDB();
      const sessions = await Session.find({ _id: { $in: sessionIds } }).lean();

      const updatedSessions = await Promise.all(
        sessions.map(async (session) => {
          const updated = await Session.findByIdAndUpdate(
            session._id,
            { $pull: { players: { playerId: new mongoose.Types.ObjectId(playerId) } } },
            { new: true }
          ).lean();

          // If exempted, mark them in the payment record
          if (isExempted) {
            await Payment.findOneAndUpdate(
              { sessionId: session._id, 'players.playerId': new mongoose.Types.ObjectId(playerId) },
              { $set: { 'players.$.status': 'EXEMPTED', 'players.$.total': 0 } }
            );
          }

          return updated;
        })
      );

      const docs = updatedSessions.map(toDoc);
      for (const doc of docs) {
        await pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENTS.SESSION, { type: 'UPDATED', session: doc });
      }
      return { ok: true, sessions: docs };
    },

    // ─── Player ───────────────────────────────────────────────────────────────

    createPlayer: async (_, { input }) => {
      await connectDB();
      const existing = await Player.findOne({
        name: { $regex: `^${input.name.trim()}$`, $options: 'i' },
        isDeleted: { $ne: true },
      }).lean();
      if (existing) return { ok: false, message: `Player "${input.name}" already exists` };

      const playerInput = { name: input.name.trim() };
      if (input.gender) playerInput.gender = input.gender;
      if (input.playerLevel) playerInput.playerLevel = input.playerLevel;

      const player = await Player.create(playerInput);
      const doc = toDoc(player);
      await pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENTS.PLAYER, { type: 'CREATED', player: doc });
      return { ok: true, player: doc };
    },

    updatePlayer: async (_, { id, input }) => {
      await connectDB();
      const update = {};
      if (input.name !== undefined) update.name = input.name.trim();
      if (input.gender !== undefined) update.gender = input.gender;
      if (input.playerLevel !== undefined) update.playerLevel = input.playerLevel;
      const player = await Player.findByIdAndUpdate(id, update, { new: true }).lean();
      if (!player) return { ok: false, message: 'Player not found' };
      const doc = toDoc(player);
      await pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENTS.PLAYER, { type: 'UPDATED', player: doc });
      return { ok: true, player: doc };
    },

    deletePlayer: async (_, { id }) => {
      await connectDB();
      const player = await Player.findByIdAndUpdate(id, { isDeleted: true }, { new: true }).lean();
      if (!player) return { ok: false, message: 'Player not found' };
      const doc = toDoc(player);
      await pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENTS.PLAYER, { type: 'DELETED', player: doc });
      return { ok: true, message: 'Player deleted' };
    },

    restorePlayer: async (_, { id, name }) => {
      await connectDB();
      const update = { isDeleted: false };
      if (name) update.name = name.trim();
      const player = await Player.findByIdAndUpdate(id, update, { new: true }).lean();
      if (!player) return { ok: false, message: 'Player not found' };
      const doc = toDoc(player);
      await pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENTS.PLAYER, { type: 'RESTORED', player: doc });
      return { ok: true, player: doc };
    },

    // ─── Court ───────────────────────────────────────────────────────────────

    createCourt: async (_, { input }) => {
      await connectDB();
      const court = await Court.create({
        name: input.name,
        surfaceType: input.surfaceType || 'WOODEN',
        indoor: input.indoor ?? true,
        description: input.description || '',
        status: input.status || 'ACTIVE',
      });
      const doc = toDoc(court);
      await pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENTS.COURT, { type: 'CREATED', court: doc });
      return { ok: true, court: doc };
    },

    updateCourt: async (_, { id, input }) => {
      await connectDB();
      const existingCourt = await Court.findById(id).lean();
      if (!existingCourt) return { ok: false, message: 'Court not found' };
      if (existingCourt.status === 'OCCUPIED') {
        return { ok: false, message: 'Cannot edit court while it is occupied.' };
      }
      const court = await Court.findByIdAndUpdate(id, input, { new: true }).lean();
      const doc = toDoc(court);
      await pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENTS.COURT, { type: 'UPDATED', court: doc });
      return { ok: true, court: doc };
    },

    deleteCourt: async (_, { id }) => {
      await connectDB();
      const existingCourt = await Court.findById(id).lean();
      if (!existingCourt) return { ok: false, message: 'Court not found' };
      if (existingCourt.status === 'OCCUPIED') {
        return { ok: false, message: 'Cannot delete court while it is occupied.' };
      }
      const court = await Court.findByIdAndDelete(id).lean();
      const doc = toDoc(court);
      await pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENTS.COURT, { type: 'DELETED', court: doc });
      return { ok: true, court: doc };
    },

    // ─── Match ────────────────────────────────────────────────────────────────

    startMatch: async (_, { input }) => {
      await connectDB();

      const requestedCourtId = input.courtId || null;
      let queued = input.queued ?? false;
      let startedAt = queued ? null : new Date();
      const autoQueueReasons = [];

      const conflictingPlayerNames = await findPlayerConflictsInActiveMatches(input.playerIds);
      if (conflictingPlayerNames.length > 0) {
        queued = true;
        startedAt = null;
        autoQueueReasons.push(`Queued because player(s) are in an active match: ${conflictingPlayerNames.join(', ')}`);
      }

      if (!queued && requestedCourtId) {
        const activeOnCourt = await findActiveMatchOnCourt(requestedCourtId);
        if (activeOnCourt) {
          queued = true;
          startedAt = null;
          autoQueueReasons.push('Queued because the selected court is currently occupied.');
        }
      }

      let match;
      try {
        match = await Match.create({
          sessionId: input.sessionId,
          courtId: requestedCourtId,
          playerIds: input.playerIds,
          queued,
          startedAt,
        });
      } catch (error) {
        // If another request claimed the same court concurrently, queue this match.
        if (isDuplicateKeyError(error) && requestedCourtId && !queued) {
          queued = true;
          startedAt = null;
          autoQueueReasons.push('Queued because the selected court was claimed by another match.');
          match = await Match.create({
            sessionId: input.sessionId,
            courtId: requestedCourtId,
            playerIds: input.playerIds,
            queued,
            startedAt,
          });
        } else {
          throw error;
        }
      }

      const doc = toDoc(match);
      const ops = [
        pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENTS.MATCH, { type: 'CREATED', match: doc }),
      ];

      if (!queued && requestedCourtId) {
        // { new: true } returns the updated doc — no separate findById needed
        ops.push(
          Court.findByIdAndUpdate(requestedCourtId, { status: 'OCCUPIED' }, { new: true }).lean()
            .then((court) => court
              ? pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENTS.COURT, { type: 'UPDATED', court: toDoc(court) })
              : Promise.resolve()
            )
        );
      }

      await Promise.all(ops);
      return {
        ok: true,
        match: doc,
        message: autoQueueReasons.length > 0 ? autoQueueReasons.join(' ') : null,
      };
    },

    endMatch: async (_, { id }) => {
      await connectDB();
      // findByIdAndDelete returns the deleted doc — eliminates the separate findById round-trip
      const match = await Match.findByIdAndDelete(id).lean();
      if (!match) return { ok: true, message: 'Match not found' };

      const ops = [
        pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENTS.MATCH, { type: 'ENDED', match: toDoc(match) }),
      ];

      if (match.courtId && !match.queued) {
        // { new: true } returns the updated doc — no separate findById needed
        ops.push(
          Court.findByIdAndUpdate(match.courtId, { status: 'ACTIVE' }, { new: true }).lean()
            .then((court) => court
              ? pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENTS.COURT, { type: 'UPDATED', court: toDoc(court) })
              : Promise.resolve()
            )
        );
      }

      await Promise.all(ops);
      return { ok: true };
    },

    startQueuedMatch: async (_, { id, courtId }) => {
      await connectDB();
      const match = await Match.findById(id).lean();
      if (!match) return { ok: false, message: 'Match not found' };

      const conflictingPlayerNames = await findPlayerConflictsInActiveMatches(match.playerIds, id);
      if (conflictingPlayerNames.length > 0) {
        return {
          ok: false,
          message: `Player(s) already in an active match: ${conflictingPlayerNames.join(', ')}`,
        };
      }

      const assignedCourtId = courtId || match.courtId;

      if (assignedCourtId) {
        const activeOnCourt = await findActiveMatchOnCourt(assignedCourtId, id);
        if (activeOnCourt) {
          return { ok: false, message: 'Court is currently occupied by another active match.' };
        }
      }

      let updated;
      try {
        updated = await Match.findByIdAndUpdate(
          id,
          {
            queued: false,
            courtId: assignedCourtId || null,
            startedAt: new Date(),
          },
          { new: true }
        ).lean();
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          return { ok: false, message: 'Court is currently occupied by another active match.' };
        }
        throw error;
      }

      const doc = toDoc(updated);
      const ops = [
        pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENTS.MATCH, { type: 'STARTED', match: doc }),
      ];

      if (assignedCourtId) {
        // { new: true } returns the updated doc — no separate findById needed
        ops.push(
          Court.findByIdAndUpdate(assignedCourtId, { status: 'OCCUPIED' }, { new: true }).lean()
            .then((court) => court
              ? pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENTS.COURT, { type: 'UPDATED', court: toDoc(court) })
              : Promise.resolve()
            )
        );
      }

      await Promise.all(ops);
      return { ok: true, match: doc };
    },

    updateMatch: async (_, { id, input }) => {
      await connectDB();
      const prev = await Match.findById(id).lean();
      if (!prev) return { ok: false, message: 'Match not found' };

      const targetPlayerIds = input.playerIds !== undefined ? input.playerIds : prev.playerIds;
      const conflictingPlayerNames = await findPlayerConflictsInActiveMatches(targetPlayerIds, id);
      if (conflictingPlayerNames.length > 0) {
        return {
          ok: false,
          message: `Player(s) already in an active match: ${conflictingPlayerNames.join(', ')}`,
        };
      }

      const requestedCourtId = input.courtId !== undefined ? input.courtId : prev.courtId;
      const targetCourtChanged = input.courtId !== undefined && String(input.courtId) !== String(prev.courtId);

      if (!prev.queued && requestedCourtId) {
        const activeOnCourt = await findActiveMatchOnCourt(requestedCourtId, id);
        if (activeOnCourt) {
          return { ok: false, message: 'Court is currently occupied by another active match.' };
        }
      }

      const update = {};
      if (input.courtId !== undefined) update.courtId = input.courtId;
      if (input.playerIds !== undefined) update.playerIds = input.playerIds;

      const courtOps = [];
      // Handle court status change if court changed
      if (input.courtId && targetCourtChanged) {
        if (prev.courtId) {
          courtOps.push(
            Court.findByIdAndUpdate(prev.courtId, { status: 'ACTIVE' }, { new: true }).lean()
              .then((c) => c
                ? pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENTS.COURT, { type: 'UPDATED', court: toDoc(c) })
                : Promise.resolve()
              )
          );
        }
        courtOps.push(
          Court.findByIdAndUpdate(input.courtId, { status: 'OCCUPIED' }, { new: true }).lean()
            .then((c) => c
              ? pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENTS.COURT, { type: 'UPDATED', court: toDoc(c) })
              : Promise.resolve()
            )
        );
      }

      let match;
      try {
        [match] = await Promise.all([
          Match.findByIdAndUpdate(id, update, { new: true }).lean(),
          ...courtOps,
        ]);
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          return { ok: false, message: 'Court is currently occupied by another active match.' };
        }
        throw error;
      }
      const doc = toDoc(match);
      await pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENTS.MATCH, { type: 'UPDATED', match: doc });
      return { ok: true, match: doc };
    },

    // ─── Game ─────────────────────────────────────────────────────────────────

    recordGame: async (_, { input }) => {
      await connectDB();
      const game = await Game.create({
        sessionId: input.sessionId,
        courtId: input.courtId || null,
        players: input.playerIds,
        winnerPlayerIds: input.winnerPlayerIds || [],
        finishedAt: input.finishedAt ? new Date(input.finishedAt) : new Date(),
      });

      const isRanked = input.winnerPlayerIds && input.winnerPlayerIds.length > 0;
      const winnerSet = new Set(input.winnerPlayerIds.map(String));

      // All per-player updates + session gamesPlayed increments run in parallel.
      // Player stats use a single atomic $inc per player — no read needed.
      await Promise.all([
        // Session gamesPlayed increments (one write per player, all parallel)
        ...input.playerIds.map((pid) =>
          Session.findOneAndUpdate(
            { _id: input.sessionId, 'players.playerId': new mongoose.Types.ObjectId(pid) },
            { $inc: { 'players.$.gamesPlayed': 1 } }
          )
        ),
        // Player stats — atomic $inc avoids the read-then-write pattern
        ...input.playerIds.map((pid) => {
          const isWinner = isRanked && winnerSet.has(String(pid));
          const isLoser = isRanked && !winnerSet.has(String(pid));
          const inc = { playCount: 1 };
          if (isWinner) inc.winCount = 1;
          if (isLoser) inc.lossCount = 1;
          // winRate is recomputed after increment via a pipeline update
          return Player.findByIdAndUpdate(
            pid,
            [
              { $set: { playCount: { $add: [{ $ifNull: ['$playCount', 0] }, 1] } } },
              { $set: { winCount: isWinner ? { $add: [{ $ifNull: ['$winCount', 0] }, 1] } : { $ifNull: ['$winCount', 0] } } },
              { $set: { lossCount: isLoser ? { $add: [{ $ifNull: ['$lossCount', 0] }, 1] } : { $ifNull: ['$lossCount', 0] } } },
              {
                $set: {
                  winRate: {
                    $cond: [
                      { $gt: ['$playCount', 0] },
                      { $multiply: [{ $divide: ['$winCount', '$playCount'] }, 100] },
                      0,
                    ],
                  },
                },
              },
            ],
            { new: true }
          );
        }),
      ]);

      const doc = toDoc(game);
      await pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENTS.GAME, { type: 'CREATED', game: doc });
      return { ok: true, game: doc };
    },
  },
};

export default resolvers;
