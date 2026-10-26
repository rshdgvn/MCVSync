<?php

namespace App\Http\Requests\Staff;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;
use Illuminate\Validation\Validator;

class LogDiscrepancyRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in(['short', 'over', 'not_found'])],
            'item_id' => ['nullable', 'integer', 'exists:items,id'],
            $this->lineField() => ['nullable', 'integer', $this->lineExistsRule()],
            'scanned_quantity' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($this->input('type') === 'not_found' && ! $this->filled('item_id')) {
                $validator->errors()->add('item_id', 'item_id is required for a not_found discrepancy.');
            }

            if (in_array($this->input('type'), ['short', 'over'], true) && ! $this->filled($this->lineField())) {
                $validator->errors()->add($this->lineField(), "{$this->lineField()} is required for this discrepancy type.");
            }
        });
    }

    public function discrepancyData(): array
    {
        $validated = $this->validated();

        return [
            'line_id' => $validated[$this->lineField()] ?? null,
            'item_id' => $validated['item_id'] ?? null,
            'type' => $validated['type'],
            'scanned_quantity' => $validated['scanned_quantity'] ?? null,
            'notes' => $validated['notes'] ?? null,
        ];
    }

    protected function lineField(): string
    {
        return 'purchase_order_item_id';
    }

    protected function lineExistsRule(): Exists
    {
        return Rule::exists('purchase_order_items', 'id')
            ->where('purchase_order_id', $this->route('purchaseOrder')->id);
    }
}
