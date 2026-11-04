import type { ComponentProps } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  triggerProps?: ComponentProps<typeof SelectTrigger>;
}

export function SelectField({ value, onChange, options, placeholder, triggerProps }: SelectFieldProps) {
  return (
    <Select items={options} value={value} onValueChange={(next) => onChange(next ?? "")}>
      <SelectTrigger className="w-full" {...triggerProps}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
