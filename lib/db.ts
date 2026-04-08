import mongoose from 'mongoose';
import { setServers } from "node:dns/promises"
setServers(["1.1.1.1", "8.8.8.8"]) 

// Cache the connection across hot-reloads in development
let cached = global._mongooseCache;

if (!cached) {
  cached = global._mongooseCache = { conn: null, promise: null };
}

export async function connectDB() {
  const mongodbUri = process.env['NEXT_PUBLIC_MONGODB_URI'];
  const diagnostics = {
    hasMongoUri: Boolean(mongodbUri),
    nodeEnv: process.env['NODE_ENV'] ?? 'unknown',
    vercelEnv: process.env['VERCEL_ENV'] ?? 'missing',
    hasVercelFlag: Boolean(process.env['VERCEL']),
  };

  console.log('[DB] Available env keys:', Object.keys(process.env).filter(k => k.includes('MONGO')));
  console.log('[DB] NEXT_PUBLIC_MONGODB_URI value:', mongodbUri ? 'SET (length: ' + mongodbUri.length + ')' : 'NOT SET');

  if (!mongodbUri) {
    throw new Error(`NEXT_PUBLIC_MONGODB_URI is not defined. Diagnostics: ${JSON.stringify(diagnostics)}`);
  }
  
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(mongodbUri, {
      bufferCommands: false,
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
