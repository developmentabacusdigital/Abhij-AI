/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      '/api/**/*': ['./knowledge/**/*', './knowledge/*'],
    },
  },
};

export default nextConfig;
