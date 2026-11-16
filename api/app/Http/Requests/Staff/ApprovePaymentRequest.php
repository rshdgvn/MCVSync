<?php

namespace App\Http\Requests\Staff;

use App\Support\BusinessDate;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ApprovePaymentRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'method' => ['required', Rule::in(['bank_transfer', 'check', 'cash', 'other'])],
            'date_received' => ['required', 'date', 'before_or_equal:'.BusinessDate::todayString()],
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
