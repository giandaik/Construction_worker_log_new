/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  async redirects() {
    return [
      // /forms/new was renamed to /logs/new; keep old URLs (bookmarks, links) working.
      { source: '/forms/new', destination: '/logs/new', permanent: true },
    ];
  },
};

export default nextConfig;
