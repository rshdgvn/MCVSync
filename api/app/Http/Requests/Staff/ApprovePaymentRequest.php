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
            'date_received' => ['required', 'date'],
            'reference_note' => ['nullable', 'string', 'max:255'],
        ];
    }
}
