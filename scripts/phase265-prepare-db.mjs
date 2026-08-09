import { execSync } from 'child_process';

async function prepareDatabases() {
  console.log('=== PREPARING PHASE 26.5 DISPOSABLE DATABASES ===');

  const dbNames = [
    'kt_courier_phase265_clean',
    'kt_courier_phase265_incremental',
    'kt_courier_phase265_integration',
    'kt_courier_phase265_concurrency',
    'kt_courier_phase265_e2e'
  ];

  let containerName = 'kt-couriers-db-1';

  for (const dbName of dbNames) {
    if (!dbName.startsWith('kt_courier_phase265_')) {
      throw new Error(`Refusing to target non-phase265 database: ${dbName}`);
    }

    try {
      // Create database if not exists
      const createDbCmd = `docker exec ${containerName} psql -U postgres -c "CREATE DATABASE \\"${dbName}\\";"`;
try { execSync(createDbCmd, { stdio: ['ignore', 'pipe', 'pipe'] }); } catch {}

      // Reset schema public
      const resetSchemaCmd = `docker exec ${containerName} psql -U postgres -d "${dbName}" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;"`;
      execSync(resetSchemaCmd, { stdio: ['ignore', 'pipe', 'pipe'] });
      console.log(`Successfully reset schema public on clean disposable database "${dbName}"`);
    } catch (err) {
      console.warn(`Warning preparing database ${dbName}:`, err.message);
    }
  }

  console.log('=== DISPOSABLE DATABASES READY ===');
}

prepareDatabases().catch(err => {
  console.error('Failed to prepare disposable databases:', err.message);
  process.exit(1);
});
