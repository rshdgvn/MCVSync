<?php

namespace App\Http\Requests\Staff;

use App\Rules\DiscountWithinLineSubtotal;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePurchaseOrderItemRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'item_id' => ['required', 'integer', Rule::exists('items', 'id')->where('is_active', true)],
            'quantity_ordered' => ['required', 'integer', 'min:1'],
            'unit_cost' => ['required', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0', new DiscountWithinLineSubtotal],
        ];
    }

    public function messages(): array
    {
        return [
            'item_id.exists' => 'Choose an active item.',
        ];
    }
}
