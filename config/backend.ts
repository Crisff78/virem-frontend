// The isolated portal preview shares a fixed loopback port with its backend script.
// Keeping it here also lets Metro apply a preview connection change via Fast Refresh.
const runtimeBackendUrl = __DEV__ && process.env.EXPO_PUBLIC_PORTAL_PREVIEW === "true"
  ? "http://127.0.0.1:3103"
  : process.env.EXPO_PUBLIC_BACKEND_URL || "https://virem-backend.onrender.com";

export const BACKEND_URL = String(runtimeBackendUrl).replace(/\/+$/, "");

export const apiUrl = (path: string) =>
  `${BACKEND_URL}${path.startsWith("/") ? path : `/${path}`}`;
