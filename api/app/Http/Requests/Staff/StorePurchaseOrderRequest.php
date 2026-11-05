<?php

namespace App\Http\Requests\Staff;

use App\Rules\DiscountWithinLineSubtotal;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePurchaseOrderRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'supplier_id' => ['required', 'integer', Rule::exists('suppliers', 'id')->where('is_active', true)],
            'branch_id' => ['required', 'integer', 'exists:branches,id', $this->ownBranchOnly(...)],
            'order_date' => ['nullable', 'date'],
            'request_delivery_date' => ['nullable', 'date'],
            'terms' => ['nullable', 'string', 'max:255'],
            'remarks' => ['nullable', 'string'],

            'items' => ['required', 'array', 'min:1'],
            'items.*.item_id' => ['required', 'integer', Rule::exists('items', 'id')->where('is_active', true)],
            'items.*.quantity_ordered' => ['required', 'integer', 'min:1'],
            'items.*.unit_cost' => ['required', 'numeric', 'min:0'],
            'items.*.discount' => ['nullable', 'numeric', 'min:0', new DiscountWithinLineSubtotal],
        ];
    }

    public function messages(): array
    {
        return [
            'supplier_id.exists' => 'Choose an active supplier.',
            'items.*.item_id.exists' => 'Choose an active item.',
        ];
    }

    private function ownBranchOnly(string $attribute, mixed $value, Closure $fail): void
    {
        if (app()->bound('currentBranchId') && (int) $value !== (int) app('currentBranchId')) {
            $fail('You can only create purchase orders for your own branch.');
        }
    }
}
