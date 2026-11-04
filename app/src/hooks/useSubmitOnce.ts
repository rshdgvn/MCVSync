import { useRef } from "react";
import { isAxiosError } from "axios";

export type SubmitHandler = () => Promise<unknown> | void;

function rethrowUnexpected(error: unknown): void {
  if (!isAxiosError(error)) {
    throw error;
  }
}

export function useSubmitOnce() {
  const inFlight = useRef(false);

  return function submitOnce(submit: SubmitHandler): void {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    Promise.resolve()
      .then(submit)
      .catch(rethrowUnexpected)
      .finally(() => {
        inFlight.current = false;
      });
  };
}
