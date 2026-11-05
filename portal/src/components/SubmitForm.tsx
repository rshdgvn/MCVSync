import type { ComponentProps } from "react";
import { useSubmitOnce, type SubmitHandler } from "@/hooks/useSubmitOnce";

interface SubmitFormProps extends Omit<ComponentProps<"form">, "onSubmit"> {
  onSubmit: SubmitHandler;
}

export function SubmitForm({ onSubmit, noValidate = true, ...props }: SubmitFormProps) {
  const submitOnce = useSubmitOnce();

  return (
    <form
      noValidate={noValidate}
      {...props}
      onSubmit={(event) => {
        event.preventDefault();
        submitOnce(onSubmit);
      }}
    />
  );
}
