<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained()->restrictOnDelete();
            $table->text('notes')->nullable();
            $table->timestamp('submitted_at');
            $table->foreignId('converted_cof_id')->nullable()->constrained('client_order_forms')->nullOnDelete();
            $table->timestamps();

            $table->index(['client_id', 'submitted_at']);
        });

        Schema::create('client_submission_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_submission_id')->constrained()->cascadeOnDelete();
            $table->foreignId('item_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('quantity');
            $table->timestamps();

            $table->unique(['client_submission_id', 'item_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_submission_items');
        Schema::dropIfExists('client_submissions');
    }
};
