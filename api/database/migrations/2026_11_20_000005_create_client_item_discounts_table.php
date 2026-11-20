<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_item_discounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained()->restrictOnDelete();
            $table->foreignId('item_id')->constrained()->restrictOnDelete();
            $table->decimal('discount_percent', 5, 2);
            $table->foreignId('set_by')->constrained('employees')->restrictOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['client_id', 'item_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_item_discounts');
    }
};
