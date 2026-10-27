import { api } from "@/api/client";
import { ensureCsrfCookie } from "@/api/csrf";
import type { User } from "@/types/user";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
}

interface LoginResponse {
  message: string;
  user: User;
}

export async function login(payload: LoginPayload): Promise<User> {
  await ensureCsrfCookie();
  const response = await api.post<LoginResponse>("/portal/auth/login", payload);
  return response.data.user;
}

export async function logout(): Promise<void> {
  await api.post("/portal/auth/logout");
}

export async function me(): Promise<User> {
  const response = await api.get<User>("/portal/auth/me");
  return response.data;
}

export async function forgotPassword(payload: ForgotPasswordPayload): Promise<void> {
  await ensureCsrfCookie();
  await api.post("/portal/auth/password/forgot", payload);
}

export async function resetPassword(payload: ResetPasswordPayload): Promise<void> {
  await ensureCsrfCookie();
  await api.post("/portal/auth/password/reset", payload);
}
