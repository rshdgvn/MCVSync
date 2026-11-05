<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\DataAwareRule;
use Illuminate\Contracts\Validation\ValidationRule;

class DiscountWithinLineSubtotal implements DataAwareRule, ValidationRule
{
    private array $data = [];

    public function setData(array $data): static
    {
        $this->data = $data;

        return $this;
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $prefix = str_contains($attribute, '.') ? substr($attribute, 0, strrpos($attribute, '.') + 1) : '';
        $quantity = data_get($this->data, $prefix.'quantity_ordered');
        $unitCost = data_get($this->data, $prefix.'unit_cost');

        if (! is_numeric($quantity) || ! is_numeric($unitCost) || ! is_numeric($value)) {
            return;
        }

        if ((float) $value > (float) $quantity * (float) $unitCost) {
            $fail('The discount can\'t be more than the line subtotal (quantity × unit cost).');
        }
    }
}
