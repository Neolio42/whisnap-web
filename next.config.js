/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      // NextJS <Image> component needs to whitelist domains for src={}
      "lh3.googleusercontent.com",
      "pbs.twimg.com",
      "images.unsplash.com",
      "logos-world.net",
    ],
  },
  // Enable standalone output for Docker
  output: 'standalone',
  // Disable telemetry in production
  telemetry: false,
  // Exclude API directory from Next.js compilation
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    
    // Exclude API directory from compilation
    config.module.rules.push({
      test: /\.(js|jsx|ts|tsx)$/,
      exclude: /\/api\//,
    });
    
    return config;
  },
};

module.exports = nextConfig;