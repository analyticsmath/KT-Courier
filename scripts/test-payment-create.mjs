import { createPayableOrder, paymentPrisma } from '../tests/integration/payment-fixtures.js';

async function main() {
  const fixture = await createPayableOrder();
  console.log('Fixture user:', fixture.user.id, 'Order:', fixture.order.id);

  console.log('Testing create WITHOUT include...');
  try {
    const p1 = await paymentPrisma.payment.create({
      data: {
        publicReference: 'pay_test_' + Date.now(),
        userId: fixture.user.id,
        orderId: fixture.order.id,
        subjectType: 'COURIER_ORDER',
        purpose: 'ORDER',
        status: 'CREATED',
        amount: 115.00,
        currency: 'ZAR',
        creationIdempotencyKey: 'idem_test_' + Date.now(),
        creationRequestHash: 'a'.repeat(64),
      }
    });
    console.log('p1 created:', p1.id);
  } catch (err) {
    console.error('Error p1:', err);
  }

  const fixture2 = await createPayableOrder();
  console.log('Testing create WITH include...');
  try {
    const p2 = await paymentPrisma.payment.create({
      data: {
        publicReference: 'pay_test2_' + Date.now(),
        userId: fixture2.user.id,
        orderId: fixture2.order.id,
        subjectType: 'COURIER_ORDER',
        purpose: 'ORDER',
        status: 'CREATED',
        amount: 115.00,
        currency: 'ZAR',
        creationIdempotencyKey: 'idem_test2_' + Date.now(),
        creationRequestHash: 'b'.repeat(64),
      },
      include: {
        order: { select: { id: true, orderNumber: true } },
        user: { select: { id: true, name: true } },
      }
    });
    console.log('p2 created:', p2.id);
  } catch (err) {
    console.error('Error p2:', err);
  }
}

main().catch(err => console.error(err)).finally(() => paymentPrisma.$disconnect());
