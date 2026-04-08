import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER'] },
    playerLevel: {
      type: String,
      enum: ['BEGINNER', 'INTERMEDIATE', 'UPPERINTERMEDIATE', 'ADVANCED'],
    },
    playCount: { type: Number, default: 0 },
    winCount: { type: Number, default: 0 },
    lossCount: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.Player || mongoose.model('Player', playerSchema);
