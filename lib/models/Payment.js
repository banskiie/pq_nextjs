import mongoose from 'mongoose';

const paymentPlayerSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    gamesPlayed: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    status: { type: String, enum: ['PAID', 'UNPAID', 'EXEMPTED'], default: 'UNPAID' },
    checkedOutAt: { type: Date },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    pricePerGame: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    closedAt: { type: Date },
    players: [paymentPlayerSchema],
  },
  { timestamps: true }
);

export default mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
