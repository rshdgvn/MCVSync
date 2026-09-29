<?php

namespace App\Http\Requests\Staff;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class LogDiscrepancyRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in(['short', 'over', 'not_found_on_po'])],
            'item_id' => ['nullable', 'integer', 'exists:items,id'],
            'purchase_order_item_id' => [
                'nullable',
                'integer',
                Rule::exists('purchase_order_items', 'id')
                    ->where('purchase_order_id', $this->route('purchaseOrder')->id),
            ],
            'scanned_quantity' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($this->input('type') === 'not_found_on_po' && ! $this->filled('item_id')) {
                $validator->errors()->add('item_id', 'item_id is required for a not_found_on_po discrepancy.');
            }

            if (in_array($this->input('type'), ['short', 'over'], true) && ! $this->filled('purchase_order_item_id')) {
                $validator->errors()->add('purchase_order_item_id', 'purchase_order_item_id is required for this discrepancy type.');
            }
        });
    }
}
