<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('discrepancies', function (Blueprint $table) {
            $table->id();
            $table->string('reference_type');
            $table->unsignedBigInteger('reference_id');
            $table->string('reference_item_type')->nullable();
            $table->unsignedBigInteger('reference_item_id')->nullable();
            $table->foreignId('item_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('type', ['short', 'over', 'not_found']);
            $table->unsignedInteger('scanned_quantity')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('resolved')->default(false);
            $table->foreignId('resolved_by')->nullable()->constrained('employees')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['reference_type', 'reference_id']);
            $table->index(['reference_item_type', 'reference_item_id']);
            $table->index('resolved');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('discrepancies');
    }
};
