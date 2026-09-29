<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('item_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('quantity_ordered');
            // Written by the Receiving Stock pass, not this one — exists
            // now so that pass has somewhere to record partial/full
            // receipt without a later schema change.
            $table->unsignedInteger('quantity_received')->default(0);
            $table->decimal('unit_cost', 10, 2);
            $table->decimal('discount', 10, 2)->default(0);
            // Snapshot at write time (quantity_ordered * unit_cost -
            // discount), never recalculated live — a later change to the
            // item's own cost must not silently alter an already-placed
            // PO's historical total.
            $table->decimal('total', 10, 2);
            $table->timestamps();

            $table->index('purchase_order_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_order_items');
    }
};
