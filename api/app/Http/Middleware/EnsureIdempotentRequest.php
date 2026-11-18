<?php

namespace App\Http\Middleware;

use App\Services\IdempotencyService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureIdempotentRequest
{
    public function __construct(private readonly IdempotencyService $idempotency) {}

    public function handle(Request $request, Closure $next): Response
    {
        $key = $request->header(IdempotencyService::HEADER);

        if ($key === null) {
            return $next($request);
        }

        return $this->idempotency->handle($request, $key, $request->user('staff')->id, fn () => $next($request));
    }
}
