<?php

namespace App\Http\Requests\Staff;

use Illuminate\Foundation\Http\FormRequest;

/**
 * item_id is deliberately not editable here — changing which item a line
 * refers to is a remove-and-re-add, not an edit.
 */
class UpdatePurchaseOrderItemRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'quantity_ordered' => ['required', 'integer', 'min:1'],
            'unit_cost' => ['required', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
