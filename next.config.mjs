/** Static export so the app can be hosted on GitHub Pages / Infinity Free. */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  basePath,
  turbopack: { root: import.meta.dirname },
};
export default nextConfig;
