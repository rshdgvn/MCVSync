<?php

namespace App\Http\Requests\Staff;

use Illuminate\Foundation\Http\FormRequest;

class DeclineTransferRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'decline_reason' => ['required', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'decline_reason.required' => 'Say why this request is being declined.',
        ];
    }
}
