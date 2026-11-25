<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->foreignId('branch_id')->nullable()->after('zone_id')->constrained()->restrictOnDelete();
        });

        $mainBranchId = DB::table('branches')->where('is_main', true)->value('id');

        if ($mainBranchId !== null) {
            DB::table('clients')->whereNull('branch_id')->update(['branch_id' => $mainBranchId]);
        }
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropConstrainedForeignId('branch_id');
        });
    }
};
