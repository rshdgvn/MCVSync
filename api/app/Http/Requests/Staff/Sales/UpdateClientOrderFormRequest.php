<?php

namespace App\Http\Requests\Staff\Sales;

use App\Http\Requests\Concerns\ValidatesOrderLines;
use Illuminate\Foundation\Http\FormRequest;

class UpdateClientOrderFormRequest extends FormRequest
{
    use ValidatesOrderLines;

    public function rules(): array
    {
        return [
            'terms' => ['sometimes', 'nullable', 'string', 'max:100'],
            'request_delivery_date' => ['sometimes', 'nullable', 'date'],
            'remarks' => ['sometimes', 'nullable', 'string', 'max:2000'],
            ...$this->orderLineRules(true, false),
        ];
    }

    public function messages(): array
    {
        return $this->orderLineMessages();
    }

    public function headerFields(): array
    {
        return collect($this->validated())->only(['terms', 'request_delivery_date', 'remarks'])->all();
    }
}
