<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const LINE_TABLES = ['purchase_order_items', 'transfer_request_items'];

    public function up(): void
    {
        Schema::table('discrepancies', function (Blueprint $table) {
            $table->enum('resolution', ['accepted', 'redelivery_requested'])->nullable()->after('resolved_at');
        });

        foreach (self::LINE_TABLES as $lineTable) {
            Schema::table($lineTable, function (Blueprint $table) {
                $table->unsignedInteger('short_accepted_quantity')->default(0)->after('quantity_received');
            });
        }
    }

    public function down(): void
    {
        foreach (self::LINE_TABLES as $lineTable) {
            Schema::table($lineTable, function (Blueprint $table) {
                $table->dropColumn('short_accepted_quantity');
            });
        }

        Schema::table('discrepancies', function (Blueprint $table) {
            $table->dropColumn('resolution');
        });
    }
};
