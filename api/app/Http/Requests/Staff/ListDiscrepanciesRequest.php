<?php

namespace App\Http\Requests\Staff;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListDiscrepanciesRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'resolved' => ['nullable', 'boolean'],
            'type' => ['nullable', Rule::in(['short', 'over', 'not_found'])],
            'reference_type' => ['nullable', Rule::in(['purchase_order', 'transfer_request'])],
            'reference_id' => ['nullable', 'integer', 'required_with:reference_type'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }

    public function filters(): array
    {
        return array_filter([
            'resolved' => $this->has('resolved') ? $this->boolean('resolved') : null,
            'type' => $this->validated('type'),
            'reference_type' => $this->validated('reference_type'),
            'reference_id' => $this->filled('reference_id') ? $this->integer('reference_id') : null,
        ], fn ($value) => $value !== null);
    }
}
