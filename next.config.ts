import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@solana/wallet-adapter-base",
    "@solana/wallet-adapter-react",
    "@solana/wallet-adapter-react-ui",
    "@solana/wallet-adapter-wallets",
    "@solana/wallet-adapter-phantom",
  ],
  webpack: (config, { isServer }) => {
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false,
      net: false,
      tls: false,
    };
    // Phaser touches `window` at evaluation — keep it out of the server bundle.
    if (isServer) {
      const prior = config.externals;
      config.externals = [
        ...(Array.isArray(prior) ? prior : prior ? [prior] : []),
        "phaser",
      ];
    }
    return config;
  },
};

export default nextConfig;
