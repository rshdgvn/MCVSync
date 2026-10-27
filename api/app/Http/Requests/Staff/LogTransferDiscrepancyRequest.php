<?php

namespace App\Http\Requests\Staff;

use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;

class LogTransferDiscrepancyRequest extends LogDiscrepancyRequest
{
    protected function lineField(): string
    {
        return 'transfer_request_item_id';
    }

    protected function lineExistsRule(): Exists
    {
        return Rule::exists('transfer_request_items', 'id')
            ->where('transfer_request_id', $this->route('transferRequest')->id);
    }
}
