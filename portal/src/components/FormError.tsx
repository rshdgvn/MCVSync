interface FormErrorProps {
  message: string | null | undefined;
}

export function FormError({ message }: FormErrorProps) {
  if (!message) {
    return null;
  }

  return (
    <p role="alert" className="bg-danger-muted px-3 py-2 text-sm text-danger md:text-xs">
      {message}
    </p>
  );
}
