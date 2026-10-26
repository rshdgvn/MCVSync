<?php

namespace App\Http\Requests\Staff;

use Illuminate\Foundation\Http\FormRequest;

class PickStockRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'item_id' => ['required', 'integer', 'exists:items,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'batch_id' => ['nullable', 'integer', 'exists:batches,id'],
            'override_code' => ['nullable', 'string', 'max:32'],
            'override_reason' => ['required_with:override_code', 'nullable', 'string', 'max:1000'],
        ];
    }
}
