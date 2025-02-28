
const config = {
  output: 'export',
  // Only use basePath in production, not during development
  basePath: process.env.NODE_ENV === 'production' ? '/content/tools/metronome' : '',
  images: {
    unoptimized: true,
  },
  // Skip generating unnecessary files
  skipTrailingSlashRedirect: true,
  skipMiddlewareUrlNormalize: true,
  distDir: 'out',
};

export default config;
