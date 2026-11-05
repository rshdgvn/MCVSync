import { isAxiosError } from "axios";

export function getErrorMessage(error: unknown): string {
  if (isAxiosError<{ message?: string; errors?: Record<string, string[]> }>(error)) {
    const errors = error.response?.data?.errors;
    if (errors) {
      const firstField = Object.values(errors)[0];
      if (firstField?.[0]) {
        return firstField[0];
      }
    }

    if (error.response?.data?.message) {
      return error.response.data.message;
    }
  }

  return "Something went wrong. Please try again.";
}

/**
 * Per-field messages from a Laravel 422 validation response, so a form can
 * surface each error next to its own input instead of one generic banner.
 */
export function getFieldErrors(error: unknown): Record<string, string> {
  if (!isAxiosError<{ errors?: Record<string, string[]> }>(error)) {
    return {};
  }

  const errors = error.response?.data?.errors;
  if (!errors) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(errors)
      .filter(([, messages]) => messages?.[0])
      .map(([field, messages]) => [field, messages[0]]),
  );
}

export function getGeneralError(error: unknown): string | null {
  if (!error) {
    return null;
  }
  return Object.keys(getFieldErrors(error)).length === 0 ? getErrorMessage(error) : null;
}
