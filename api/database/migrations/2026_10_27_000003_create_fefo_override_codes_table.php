<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fefo_override_codes', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->foreignId('generated_by')->constrained('employees')->restrictOnDelete();
            $table->boolean('used')->default(false);
            $table->foreignId('used_by')->nullable()->constrained('employees')->nullOnDelete();
            $table->timestamp('used_at')->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fefo_override_codes');
    }
};
