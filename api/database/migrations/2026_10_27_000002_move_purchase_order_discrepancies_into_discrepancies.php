<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('discrepancies')->insertUsing(
            [
                'reference_type',
                'reference_id',
                'reference_item_type',
                'reference_item_id',
                'item_id',
                'type',
                'scanned_quantity',
                'notes',
                'resolved',
                'resolved_by',
                'resolved_at',
                'created_at',
                'updated_at',
            ],
            DB::table('purchase_order_discrepancies')
                ->orderBy('id')
                ->selectRaw("'purchase_order'")
                ->addSelect('purchase_order_id')
                ->selectRaw("CASE WHEN purchase_order_item_id IS NULL THEN NULL ELSE 'purchase_order_item' END")
                ->addSelect([
                    'purchase_order_item_id',
                    'item_id',
                    DB::raw("CASE WHEN type = 'not_found_on_po' THEN 'not_found' ELSE type END"),
                    'scanned_quantity',
                    'notes',
                    'resolved',
                    'resolved_by',
                    'resolved_at',
                    'created_at',
                    'updated_at',
                ]),
        );

        Schema::drop('purchase_order_discrepancies');
    }

    public function down(): void
    {
        Schema::create('purchase_order_discrepancies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('purchase_order_item_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('item_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('type', ['short', 'over', 'not_found_on_po']);
            $table->unsignedInteger('scanned_quantity')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('resolved')->default(false);
            $table->foreignId('resolved_by')->nullable()->constrained('employees')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index('purchase_order_id');
            $table->index('resolved');
        });

        DB::table('purchase_order_discrepancies')->insertUsing(
            [
                'purchase_order_id',
                'purchase_order_item_id',
                'item_id',
                'type',
                'scanned_quantity',
                'notes',
                'resolved',
                'resolved_by',
                'resolved_at',
                'created_at',
                'updated_at',
            ],
            DB::table('discrepancies')
                ->where('reference_type', 'purchase_order')
                ->orderBy('id')
                ->select([
                    'reference_id',
                    'reference_item_id',
                    'item_id',
                    DB::raw("CASE WHEN type = 'not_found' THEN 'not_found_on_po' ELSE type END"),
                    'scanned_quantity',
                    'notes',
                    'resolved',
                    'resolved_by',
                    'resolved_at',
                    'created_at',
                    'updated_at',
                ]),
        );

        DB::table('discrepancies')->where('reference_type', 'purchase_order')->delete();
    }
};
