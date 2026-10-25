<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_order_items', function (Blueprint $table) {
            // COGS is derived live as "this item's most recently created
            // PO line" — this is that lookup's index.
            $table->index(['item_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->dropIndex(['item_id', 'created_at']);
        });
    }
};
