<?php

namespace App\Http\Requests\Staff\Logistics;

use Illuminate\Foundation\Http\FormRequest;

class ConfirmDeliveryRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'delivery_date' => ['required', 'date_format:Y-m-d'],
            'received_by' => ['required', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function messages(): array
    {
        return [
            'received_by.required' => 'Enter the name of the person who received the order.',
        ];
    }
}
