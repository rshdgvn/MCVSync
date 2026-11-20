<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TYPES_BEFORE = ['receive', 'issue', 'transfer_out', 'transfer_in', 'adjustment', 'reserve', 'release'];

    private const TYPES_AFTER = [...self::TYPES_BEFORE, 'cancel_return'];

    public function up(): void
    {
        $this->allowTypes(self::TYPES_AFTER);
    }

    public function down(): void
    {
        $this->allowTypes(self::TYPES_BEFORE);
    }

    private function allowTypes(array $types): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            Schema::table('stock_transactions', function (Blueprint $table) use ($types) {
                $table->enum('type', $types)->change();
            });

            return;
        }

        $allowed = implode(', ', array_map(fn (string $type) => "'{$type}'", $types));

        DB::statement('ALTER TABLE stock_transactions DROP CONSTRAINT IF EXISTS stock_transactions_type_check');
        DB::statement("ALTER TABLE stock_transactions ADD CONSTRAINT stock_transactions_type_check CHECK (type IN ({$allowed}))");
    }
};
