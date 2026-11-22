<?php

namespace App\Http\Requests\Staff\Sales;

use App\Models\IncomingClientMessage;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreIncomingMessageRequest extends FormRequest
{
    public const MAX_ATTACHMENT_KILOBYTES = 10240;

    public function rules(): array
    {
        return [
            'client_id' => ['required', 'integer', 'exists:clients,id'],
            'channel' => ['required', Rule::in(IncomingClientMessage::CHANNELS)],
            'attachment' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:'.self::MAX_ATTACHMENT_KILOBYTES],
            'received_at' => ['nullable', 'date', 'before_or_equal:now'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function messages(): array
    {
        return [
            'attachment.required' => 'Attach the screenshot or file the client sent.',
            'attachment.mimes' => 'Attach a PDF or an image (JPG, PNG or WebP).',
            'attachment.max' => 'The attachment can be at most 10 MB.',
        ];
    }
}
