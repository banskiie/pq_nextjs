import mongoose from 'mongoose';

const sessionPlayerSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    gamesPlayed: { type: Number, default: 0 },
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ['QUEUED', 'OPEN', 'CLOSED'],
      default: 'QUEUED',
    },
    isArchived: { type: Boolean, default: false },
    courts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Court' }],
    players: [sessionPlayerSchema],
    price: { type: Number },
    startedAt: { type: Date },
    endedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.models.Session || mongoose.model('Session', sessionSchema);
