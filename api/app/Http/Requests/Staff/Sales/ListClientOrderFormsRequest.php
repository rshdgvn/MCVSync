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
            'client_id' => ['nullable', 'integer'],
            'cancellation_requested' => ['nullable', 'boolean'],
        ];
    }

    public function filters(): array
    {
        return array_filter([
            'search' => $this->validated('search'),
            'status' => $this->validated('status'),
            'client_id' => $this->filled('client_id') ? $this->integer('client_id') : null,
            'cancellation_requested' => $this->filled('cancellation_requested') ? $this->boolean('cancellation_requested') : null,
        ], fn ($value) => $value !== null);
    }
}
