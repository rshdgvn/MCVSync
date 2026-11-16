<?php

namespace App\Http\Requests\Staff;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ApprovePaymentRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'method' => ['required', Rule::in(['bank_transfer', 'check', 'cash', 'other'])],
            'date_received' => ['required', 'date', 'before_or_equal:today'],
            'reference_note' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'date_received.before_or_equal' => "The date received can't be in the future.",
        ];
    }
}
