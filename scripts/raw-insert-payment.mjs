import { PrismaClient } from '@prisma/client';
import { createPayableOrder, paymentPrisma } from '../tests/integration/payment-fixtures.js';

async function main() {
  const fixture = await createPayableOrder();
  console.log('Fixture user:', fixture.user.id, 'Order:', fixture.order.id);

  try {
    const res = await paymentPrisma.$executeRawUnsafe(`
      INSERT INTO "Payment" (
        "id", "paymentNumber", "userId", "orderId", "subjectType", "purpose", "status", "amount", "currency", "idempotencyKey", "creationRequestHash", "version", "latestAttemptNumber", "createdAt", "updatedAt"
      ) VALUES (
        'pay_raw_123', 'pay_raw_ref_123', '${fixture.user.id}', '${fixture.order.id}', 'COURIER_ORDER', 'ORDER', 'CREATED', 115.00, 'ZAR', 'idem_raw_123', 'a', 0, 0, NOW(), NOW()
      );
    `);
    console.log('Raw SQL insert result:', res);
  } catch (err) {
    console.error('Raw SQL insert error:', err);
  }
}

main().catch(err => console.error(err)).finally(() => paymentPrisma.$disconnect());
