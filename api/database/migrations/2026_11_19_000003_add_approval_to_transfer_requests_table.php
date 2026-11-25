<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const STATUSES_BEFORE = ['pending', 'shipped', 'closed', 'cancelled'];

    private const STATUSES_AFTER = ['awaiting_approval', 'pending', 'shipped', 'closed', 'cancelled', 'declined'];

    public function up(): void
    {
        $this->allowStatuses(self::STATUSES_AFTER, 'awaiting_approval');

        Schema::table('transfer_requests', function (Blueprint $table) {
            $table->string('decline_reason', 500)->nullable()->after('remarks');
            $table->foreignId('decided_by')->nullable()->after('decline_reason')->constrained('employees')->nullOnDelete();
            $table->timestamp('decided_at')->nullable()->after('decided_by');
        });
    }

    public function down(): void
    {
        Schema::table('transfer_requests', function (Blueprint $table) {
            $table->dropConstrainedForeignId('decided_by');
            $table->dropColumn(['decline_reason', 'decided_at']);
        });

        $this->allowStatuses(self::STATUSES_BEFORE, 'pending');
    }

    private function allowStatuses(array $statuses, string $default): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            Schema::table('transfer_requests', function (Blueprint $table) use ($statuses, $default) {
                $table->enum('status', $statuses)->default($default)->change();
            });

            return;
        }

        $allowed = implode(', ', array_map(fn (string $status) => "'{$status}'", $statuses));

        DB::statement('ALTER TABLE transfer_requests DROP CONSTRAINT IF EXISTS transfer_requests_status_check');
        DB::statement("ALTER TABLE transfer_requests ADD CONSTRAINT transfer_requests_status_check CHECK (status IN ({$allowed}))");
        DB::statement("ALTER TABLE transfer_requests ALTER COLUMN status SET DEFAULT '{$default}'");
    }
};
