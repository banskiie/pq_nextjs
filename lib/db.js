import mongoose from "mongoose"
import { setServers } from "node:dns/promises"
setServers(["1.1.1.1", "8.8.8.8"])

// Cache the connection across hot-reloads in development
let cached = global._mongooseCache

if (!cached) {
  cached = global._mongooseCache = { conn: null, promise: null }
}

const mongodbUri = process.env.MONGODB_URI

console.log(process.env.MONGODB_URI)

export async function connectDB() {
  if (!mongodbUri) {
    throw new Error(`MONGODB_URI is not defined.`)
  }

  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose.connect(mongodbUri, {
      bufferCommands: false,
    })
  }

  cached.conn = await cached.promise
  return cached.conn
}
