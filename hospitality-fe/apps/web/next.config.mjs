/** @type {import('next').NextConfig} */

// In production (Coolify), set NEXT_PRIVATE_API_URL to the internal backend container URL
// e.g. NEXT_PRIVATE_API_URL=http://hospitality-backend:8000
const BACKEND_URL = process.env.NEXT_PRIVATE_API_URL || 'http://localhost:8000';

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${BACKEND_URL}/api/v1/:path*`,
      },
      {
        source: '/auth/:path*',
        destination: `${BACKEND_URL}/auth/:path*`,
      },
    ];
  },
};

export default nextConfig;
