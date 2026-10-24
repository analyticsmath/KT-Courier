import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { it } from 'vitest';

it('keeps provable history read only while native and uncertain orders remain live, preserving original records', async () => {
const db=new PGlite();
await db.exec(`
CREATE TABLE "MarketplaceStoreOrder" (id text primary key,"publicReference" text,"marketplaceOrderId" text,"createdAt" timestamptz,"operationalPolicyId" text,"deliveryBridgeStatus" text DEFAULT 'NOT_REQUESTED',status text DEFAULT 'SETTLED',"resolutionStatus" text DEFAULT 'RECONCILIATION_REQUIRED');
CREATE TABLE "MarketplaceOrder" (id text primary key,"publicReference" text,"checkoutId" text,"paymentId" text,"commercialFingerprint" text);
CREATE TABLE "MarketplaceCheckout" (id text primary key,"publicReference" text,"commercialFingerprint" text);
CREATE TABLE "Payment" (id text primary key,"successfulAttemptId" text,provider text,"paymentNumber" text,"idempotencyKey" text,"creationRequestHash" text,amount numeric DEFAULT 123.45);
CREATE TABLE "PaymentAttempt" (id text primary key,"paymentId" text,provider text,"providerReference" text,"idempotencyKey" text);
CREATE TABLE "LegacyMigrationRun" (id text primary key,status text);
CREATE TABLE "LegacyMigrationMap" (id text primary key,"runId" text,"targetModel" text,"targetId" text,"sourceTable" text,disposition text);
`);
for(let i=1;i<=8;i++){
const ref='MKT-2026-'+String(i).padStart(6,'0');
await db.query(`INSERT INTO "MarketplaceCheckout" VALUES ($1,$2,$3)`,['c'+i,ref.replace('MKT-','CHK-'),'fp-'+ref]);
await db.query(`INSERT INTO "MarketplaceOrder" VALUES ($1,$2,$3,$4,$5)`,['m'+i,ref,'c'+i,'p'+i,'fp-'+ref]);
await db.query(`INSERT INTO "PaymentAttempt" VALUES ($1,$2,'PAYFAST',$3,$4)`,['a'+i,'p'+i,'pf_mkt_'+ref,'att_idem_mkt_'+ref]);
await db.query(`INSERT INTO "Payment" (id,"successfulAttemptId",provider,"paymentNumber","idempotencyKey","creationRequestHash") VALUES ($1,$2,'PAYFAST',$3,$4,encode(sha256(convert_to($5,'UTF8')),'hex'))`,['p'+i,'a'+i,'PAY-'+ref,'idem_pay_mkt_'+ref,'pay_mkt_'+ref]);
await db.query(`INSERT INTO "MarketplaceStoreOrder" (id,"publicReference","marketplaceOrderId","createdAt") VALUES ($1,$2,$3,'2026-06-01')`,['s'+i,ref.replace('MKT-','MSO-'),'m'+i]);
}
await db.exec(`UPDATE "Payment" SET "idempotencyKey"='native-payment' WHERE id IN ('p2','p4','p5','p6','p7');
UPDATE "Payment" SET provider='PAYSTACK' WHERE id='p3';
UPDATE "MarketplaceStoreOrder" SET "operationalPolicyId"='real-policy' WHERE id='s8';
INSERT INTO "LegacyMigrationRun" VALUES ('applied','APPLIED'),('draft','PLANNED');
INSERT INTO "LegacyMigrationMap" VALUES ('map4','applied','MarketplaceStoreOrder','s4','orders','HISTORICAL_READ_ONLY'),('map5','applied','Store','s5','stores','HISTORICAL_READ_ONLY'),('map6','draft','MarketplaceStoreOrder','s6','orders','HISTORICAL_READ_ONLY');`);
const before=(await db.query(`SELECT id,status,"resolutionStatus","marketplaceOrderId" FROM "MarketplaceStoreOrder" ORDER BY id`)).rows;
const money=(await db.query(`SELECT * FROM "Payment" ORDER BY id`)).rows;
await db.exec(readFileSync(new URL('../../prisma/migrations/20261025010000_marketplace_historical_operational_scope/migration.sql', import.meta.url),'utf8'));
const rows=(await db.query<{id: string; operationalScope: string}>(`SELECT id,"operationalScope" FROM "MarketplaceStoreOrder" ORDER BY id`)).rows;
assert.deepEqual(rows.map(r=>r.operationalScope),['HISTORICAL','LIVE','LIVE','HISTORICAL','LIVE','LIVE','LIVE','LIVE']);
assert.deepEqual((await db.query(`SELECT id,status,"resolutionStatus","marketplaceOrderId" FROM "MarketplaceStoreOrder" ORDER BY id`)).rows,before);
assert.deepEqual((await db.query(`SELECT * FROM "Payment" ORDER BY id`)).rows,money);
await assert.rejects(db.exec(`UPDATE "MarketplaceStoreOrder" SET "operationalScope"='HISTORICAL',"historySourceReference"='override' WHERE id='s2'`),/origin is immutable/);
await assert.rejects(db.exec(`INSERT INTO "MarketplaceStoreOrder" (id,"operationalScope") VALUES ('invalid','HISTORICAL')`),/history_scope_check/);
await db.exec(`INSERT INTO "MarketplaceStoreOrder" (id) VALUES ('new-order')`);
assert.equal((await db.query<{operationalScope: string}>(`SELECT "operationalScope" FROM "MarketplaceStoreOrder" WHERE id='new-order'`)).rows[0].operationalScope,'LIVE');
await db.close();

}, 30_000);
