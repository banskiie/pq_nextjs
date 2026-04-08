import mongoose from 'mongoose';

const gameSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    courtId: { type: mongoose.Schema.Types.ObjectId, ref: 'Court' },
    players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
    winnerPlayerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
    finishedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.models.Game || mongoose.model('Game', gameSchema);
