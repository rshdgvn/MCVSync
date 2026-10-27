import axios, { isAxiosError, type InternalAxiosRequestConfig } from "axios";
import { refreshCsrfCookie } from "@/api/csrf";

const CSRF_TOKEN_MISMATCH = 419;

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

api.interceptors.response.use(undefined, async (error: unknown) => {
  if (!isAxiosError(error) || error.response?.status !== CSRF_TOKEN_MISMATCH) {
    return Promise.reject(error);
  }

  const config = error.config as RetryableRequestConfig | undefined;

  if (!config || config.csrfRetried) {
    return Promise.reject(error);
  }

  config.csrfRetried = true;
  await refreshCsrfCookie();

  return api(config);
});
