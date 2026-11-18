<?php

namespace App\Http\Requests\Staff;

use App\Models\Discrepancy;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ResolveDiscrepancyRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'resolution' => ['required', Rule::in(Discrepancy::RESOLUTIONS)],
            'resolution_note' => ['nullable', 'string', 'max:1000'],
            'item_id' => ['nullable', 'integer', 'exists:items,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'resolution.required' => 'Choose whether to accept the discrepancy or request a redelivery.',
            'resolution.in' => 'Choose whether to accept the discrepancy or request a redelivery.',
        ];
    }
}
