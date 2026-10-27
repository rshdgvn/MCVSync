import axios from "axios";

const apiOrigin = import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "");

function hasCsrfCookie(): boolean {
  return document.cookie.split("; ").some((cookie) => cookie.startsWith("XSRF-TOKEN="));
}

export async function refreshCsrfCookie() {
  await axios.get(`${apiOrigin}/sanctum/csrf-cookie`, {
    withCredentials: true,
  });
}

export async function ensureCsrfCookie() {
  if (!hasCsrfCookie()) {
    await refreshCsrfCookie();
  }
}
