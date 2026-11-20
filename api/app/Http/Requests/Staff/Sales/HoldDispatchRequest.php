<?php

namespace App\Http\Requests\Staff\Sales;

use Illuminate\Foundation\Http\FormRequest;

class HoldDispatchRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'note' => ['required', 'string', 'max:1000'],
        ];
    }

    public function messages(): array
    {
        return [
            'note.required' => 'Add a note saying what still needs follow-up.',
        ];
    }
}
