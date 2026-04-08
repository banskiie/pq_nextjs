import { existsSync } from 'node:fs'
import path from 'node:path'
import { config as loadDotenv } from 'dotenv'

const productionEnvPath = path.join(process.cwd(), '.env.production')

if (existsSync(productionEnvPath)) {
	loadDotenv({ path: productionEnvPath, override: false })
}

/** @type {import('next').NextConfig} */
const nextConfig = {
	devIndicators: false,
}

export default nextConfig
