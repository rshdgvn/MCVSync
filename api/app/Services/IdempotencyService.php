<?php

namespace App\Services;

use App\Models\IdempotencyKey;
use Closure;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class IdempotencyService
{
    public const HEADER = 'Idempotency-Key';

    public const REPLAYED_HEADER = 'Idempotent-Replayed';

    public function handle(Request $request, string $key, int $userId, Closure $process): Response
    {
        if (! Str::isUuid($key)) {
            return $this->invalidKey();
        }

        $fingerprint = $this->fingerprint($request);
        $stored = $this->find($key, $userId);

        if ($stored) {
            return $this->replay($stored, $fingerprint);
        }

        try {
            return $this->processOnce($key, $userId, $fingerprint, $process);
        } catch (UniqueConstraintViolationException) {
            return $this->replay($this->find($key, $userId), $fingerprint);
        }
    }

    private function processOnce(string $key, int $userId, string $fingerprint, Closure $process): Response
    {
        DB::beginTransaction();

        try {
            $response = $process();

            if (! $response->isSuccessful()) {
                DB::rollBack();

                return $response;
            }

            IdempotencyKey::create([
                'key' => $key,
                'user_id' => $userId,
                'fingerprint' => $fingerprint,
                'response_status' => $response->getStatusCode(),
                'response_body' => (string) $response->getContent(),
            ]);

            DB::commit();

            return $response;
        } catch (Throwable $exception) {
            DB::rollBack();

            throw $exception;
        }
    }

    private function find(string $key, int $userId): ?IdempotencyKey
    {
        return IdempotencyKey::where('key', $key)->where('user_id', $userId)->first();
    }

    private function replay(IdempotencyKey $stored, string $fingerprint): Response
    {
        if (! hash_equals($stored->fingerprint, $fingerprint)) {
            return new JsonResponse(['message' => 'This Idempotency-Key was already used for a different request.'], Response::HTTP_CONFLICT);
        }

        return new Response($stored->response_body, $stored->response_status, [
            'Content-Type' => 'application/json',
            self::REPLAYED_HEADER => 'true',
        ]);
    }

    private function fingerprint(Request $request): string
    {
        return hash('sha256', $request->method().'|'.$request->path().'|'.json_encode($request->all()));
    }

    private function invalidKey(): JsonResponse
    {
        return new JsonResponse([
            'message' => 'The Idempotency-Key header must be a UUID.',
            'errors' => ['idempotency_key' => ['The Idempotency-Key header must be a UUID.']],
        ], Response::HTTP_UNPROCESSABLE_ENTITY);
    }
}
