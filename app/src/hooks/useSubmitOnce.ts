import { useRef } from "react";

export function useSubmitOnce() {
  const inFlight = useRef(false);

  return function submitOnce(submit: (release: () => void) => void) {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    submit(() => {
      inFlight.current = false;
    });
  };
}
