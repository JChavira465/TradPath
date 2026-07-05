/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@tradpath/api-client", "@tradpath/types"],
};

module.exports = nextConfig;
