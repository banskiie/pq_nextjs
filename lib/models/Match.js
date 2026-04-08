import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    courtId: { type: mongoose.Schema.Types.ObjectId, ref: 'Court' },
    playerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
    queued: { type: Boolean, default: false },
    startedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.models.Match || mongoose.model('Match', matchSchema);
