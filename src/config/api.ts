// All API calls use relative URLs.
// In dev: Express server (server.ts) handles /api/** on localhost:3000.
// In prod: Firebase Hosting rewrites /api/** → Firebase Function "api".
export const apiUrl = (path: string) => `/api${path}`;
