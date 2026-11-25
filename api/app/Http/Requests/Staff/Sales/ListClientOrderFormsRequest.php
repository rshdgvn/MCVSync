<?php

namespace App\Http\Requests\Staff\Sales;

use App\Models\ClientOrderForm;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListClientOrderFormsRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', Rule::in(ClientOrderForm::STATUSES)],
            'source_type' => ['nullable', Rule::in(['portal', 'manual'])],
            'client_id' => ['nullable', 'integer'],
            'cancellation_requested' => ['nullable', 'boolean'],
        ];
    }

    public function filters(): array
    {
        return array_filter([
            'search' => $this->validated('search'),
            'status' => $this->validated('status'),
            'source_type' => $this->validated('source_type'),
            'client_id' => $this->filled('client_id') ? $this->integer('client_id') : null,
            'cancellation_requested' => $this->filled('cancellation_requested') ? $this->boolean('cancellation_requested') : null,
        ], fn ($value) => $value !== null);
    }
}
