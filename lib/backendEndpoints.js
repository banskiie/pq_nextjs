/**
 * Returns a URL for a local Next.js API route path.
 * e.g. getBackendApiUrl('/api/players/bulk') → '/api/players/bulk'
 */
export const getBackendApiUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return normalizedPath;
};
