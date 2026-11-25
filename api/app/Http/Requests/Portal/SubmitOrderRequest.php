<?php

namespace App\Http\Requests\Portal;

use App\Http\Requests\Concerns\ValidatesOrderLines;
use Illuminate\Foundation\Http\FormRequest;

class SubmitOrderRequest extends FormRequest
{
    use ValidatesOrderLines;

    public function rules(): array
    {
        return [
            'notes' => ['nullable', 'string', 'max:2000'],
            ...$this->orderLineRules(false),
        ];
    }

    public function messages(): array
    {
        return $this->orderLineMessages();
    }
}
