import axios, { isAxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { refreshCsrfCookie } from "@/api/csrf";
import { purgeUserData } from "@/pwa/userCache";
import { useSyncStore } from "@/stores/sync.store";

const CSRF_TOKEN_MISMATCH = 419;
const UNAUTHENTICATED = 401;
const LOGIN_PATH = "/login";

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  csrfRetried?: boolean;
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  withXSRFToken: true,
  headers: {
    Accept: "application/json",
  },
});

function recordServerTime(response: AxiosResponse): void {
  const header = response.headers["date"];
  const time = typeof header === "string" ? Date.parse(header) : Number.NaN;
  if (!Number.isNaN(time)) {
    useSyncStore.getState().recordServerTime(time);
  }
}

function isAuthRequest(config: InternalAxiosRequestConfig | undefined): boolean {
  return Boolean(config?.url && /\/auth\/(login|me)$/.test(config.url));
}

async function handleSessionExpired(config: InternalAxiosRequestConfig | undefined): Promise<void> {
  await purgeUserData();
  if (!isAuthRequest(config) && window.location.pathname !== LOGIN_PATH) {
    window.location.replace(LOGIN_PATH);
  }
}

api.interceptors.response.use(
  (response) => {
    recordServerTime(response);
    return response;
  },
  async (error: unknown) => {
    if (!isAxiosError(error)) {
      return Promise.reject(error);
    }

    if (error.response?.status === UNAUTHENTICATED) {
      await handleSessionExpired(error.config);
      return Promise.reject(error);
    }

    if (error.response?.status !== CSRF_TOKEN_MISMATCH) {
      return Promise.reject(error);
    }

    const config = error.config as RetryableRequestConfig | undefined;

    if (!config || config.csrfRetried) {
      return Promise.reject(error);
    }

    config.csrfRetried = true;
    await refreshCsrfCookie();

    return api(config);
  },
);
