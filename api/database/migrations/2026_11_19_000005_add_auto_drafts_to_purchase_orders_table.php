<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->foreignId('preferred_supplier_id')->nullable()->after('reorder_quantity')->constrained('suppliers')->nullOnDelete();
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->unsignedBigInteger('supplier_id')->nullable()->change();
            $table->unsignedBigInteger('prepared_by')->nullable()->change();
            $table->enum('source', ['manual', 'auto_low_stock', 'auto_shortage'])->default('manual')->after('remarks');
            $table->index(['branch_id', 'status', 'supplier_id']);
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropIndex(['branch_id', 'status', 'supplier_id']);
            $table->dropColumn('source');
            $table->unsignedBigInteger('supplier_id')->nullable(false)->change();
            $table->unsignedBigInteger('prepared_by')->nullable(false)->change();
        });

        Schema::table('items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('preferred_supplier_id');
        });
    }
};
