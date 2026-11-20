<?php

namespace App\Http\Requests\Staff\Sales;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreClientDiscountRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'client_id' => ['required', 'integer', 'exists:clients,id'],
            'item_id' => ['required', 'integer', Rule::exists('items', 'id')->where('is_active', true)],
            'discount_percent' => ['required', 'numeric', 'min:0', 'max:100'],
        ];
    }
}
