<?php

namespace App\Http\Requests\Staff;

use Illuminate\Foundation\Http\FormRequest;

class ResolveDiscrepancyRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'resolution_note' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
