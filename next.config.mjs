/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // старый адрес ведёт на новый с тем же путём и параметрами
  async redirects() {
    return [{ source: '/:path*', has: [{ type: 'host', value: 'zhk-radar.vercel.app' }], destination: 'https://tirek-kz.vercel.app/:path*', permanent: true }];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: '*.2gis.com' },
    ],
  },
};
export default nextConfig;
