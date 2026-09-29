<?php

namespace App\Http\Requests\Staff;

use Illuminate\Foundation\Http\FormRequest;

class SetClientItemPriceRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'client_id' => ['required', 'integer', 'exists:clients,id'],
            'item_id' => ['required', 'integer', 'exists:items,id'],
            'srp' => ['required', 'numeric', 'min:0'],
        ];
    }
}
