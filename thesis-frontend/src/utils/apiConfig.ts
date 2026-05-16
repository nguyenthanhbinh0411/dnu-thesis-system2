/**
 * Shared API configuration.
 *
 * VITE_API_BASE_URL semantics:
 *   - Production (inside Docker + nginx):  /api
 *   - Development (local Vite proxy):     /api
 *   - Direct backend (rare):              http://localhost:5180
 *
 * Browser requests must NEVER use Docker service names (http://api, http://backend).
 * All traffic goes through Vite proxy (dev) or nginx proxy (prod).
 */

const envRaw = (
  import.meta.env.VITE_API_BASE_URL ?? "/api"
).toString().trim();

// Strip any protocol prefix, then extract the first non-empty path segment.
// "/api"                          → first non-empty = "api"  → "/api"
// "http://localhost:5180"          → first non-empty = "localhost:5180" → "/localhost:5180"
// "http://localhost:5180/some/path" → first non-empty = "localhost:5180" → "/localhost:5180"
const withoutProtocol = envRaw.replace(/^https?:\/\//i, "");
const segments = withoutProtocol.split("/").filter(Boolean);
const firstSegment = segments[0] ?? "";

// If the value is a path (starts with /) use it as-is.
// Otherwise wrap it as a path (for localhost:5180 etc).
export const API_BASE_PATH: string = firstSegment.startsWith("/")
  ? firstSegment
  : `/${firstSegment}`;

// Convenience exports for SignalR hubs
export const HUB_BASE_PATH: string = API_BASE_PATH;  // same /api prefix for hubs

// Export a helper to build a full API path
export function apiPath(endpoint: string): string {
  const normalized = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${API_BASE_PATH}${normalized}`;
}
