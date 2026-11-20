<?php

namespace App\Http\Requests\Staff\Sales;

use Illuminate\Foundation\Http\FormRequest;

class ApproveDispatchRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'note' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
