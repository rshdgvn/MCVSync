<?php

namespace App\Http\Requests\Staff\Sales;

use Illuminate\Foundation\Http\FormRequest;

class SendForRevisionRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'revision_reason' => ['required', 'string', 'max:1000'],
        ];
    }

    public function messages(): array
    {
        return [
            'revision_reason.required' => 'Tell the client what to change.',
        ];
    }
}
