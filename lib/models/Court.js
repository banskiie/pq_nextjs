import mongoose from 'mongoose';

const courtSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    surfaceType: {
      type: String,
      enum: ['WOODEN', 'SYNTHETIC', 'MAT', 'CONCRETE', 'RUBBER'],
      default: 'WOODEN',
    },
    indoor: { type: Boolean, default: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['ACTIVE', 'OCCUPIED', 'MAINTENANCE'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

export default mongoose.models.Court || mongoose.model('Court', courtSchema);
