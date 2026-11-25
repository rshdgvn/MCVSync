<?php

namespace App\Http\Requests\Staff\Sales;

use App\Http\Requests\Concerns\ValidatesOrderLines;
use Illuminate\Foundation\Http\FormRequest;

class StoreClientOrderFormRequest extends FormRequest
{
    use ValidatesOrderLines;

    public function rules(): array
    {
        return [
            'client_id' => ['required', 'integer', 'exists:clients,id'],
            'incoming_message_id' => ['required', 'integer', 'exists:incoming_client_messages,id'],
            'terms' => ['nullable', 'string', 'max:100'],
            'request_delivery_date' => ['nullable', 'date'],
            'remarks' => ['nullable', 'string', 'max:2000'],
            ...$this->orderLineRules(true),
        ];
    }

    public function messages(): array
    {
        return $this->orderLineMessages();
    }
}
