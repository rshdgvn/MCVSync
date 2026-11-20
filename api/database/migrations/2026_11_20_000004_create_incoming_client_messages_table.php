<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('incoming_client_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained()->restrictOnDelete();
            $table->foreignId('branch_id')->constrained()->restrictOnDelete();
            $table->enum('channel', ['messenger', 'viber', 'email']);
            $table->string('attachment_path');
            $table->string('attachment_name');
            $table->timestamp('received_at');
            $table->enum('status', ['received', 'converted'])->default('received');
            $table->foreignId('converted_cof_id')->nullable()->constrained('client_order_forms')->nullOnDelete();
            $table->foreignId('logged_by')->constrained('employees')->restrictOnDelete();
            $table->timestamps();

            $table->index(['branch_id', 'status', 'received_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('incoming_client_messages');
    }
};
