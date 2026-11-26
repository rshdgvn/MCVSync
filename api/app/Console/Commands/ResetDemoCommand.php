<?php

namespace App\Console\Commands;

use Database\Seeders\DemoDataSeeder;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('app:reset-demo')]
#[Description('Wipe the database and rebuild it with demo data for testers. Only runs when DEMO_DATA=true.')]
class ResetDemoCommand extends Command
{
    public function handle(): int
    {
        if (! config('services.demo_data')) {
            $this->error('Refusing to reset: DEMO_DATA is not true. This command wipes every table.');

            return self::FAILURE;
        }

        $steps = [
            ['migrate:fresh', ['--force' => true]],
            ['db:seed', ['--force' => true]],
            ['db:seed', ['--class' => DemoDataSeeder::class, '--force' => true]],
        ];

        foreach ($steps as [$command, $arguments]) {
            if ($this->call($command, $arguments) !== self::SUCCESS) {
                $this->error("Demo reset stopped: {$command} failed.");

                return self::FAILURE;
            }
        }

        $this->info('Demo data is ready.');

        return self::SUCCESS;
    }
}
