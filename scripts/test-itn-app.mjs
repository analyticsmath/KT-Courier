import { createPhase12Attempt, verifiedEvent } from '../tests/integration/payfast-itn-fixtures.js';
import { applyVerifiedPayfastItn } from '../lib/services/payfast-itn-application.service.js';
import { paymentPrisma } from '../tests/integration/payment-fixtures.js';

async function main() {
  try {
    const { attempt, payment } = await createPhase12Attempt();
    console.log('Payment publicReference:', payment.publicReference);
    const event = verifiedEvent(attempt, 'COMPLETE');
    console.log('Calling Promise.allSettled with 2 concurrent applyVerifiedPayfastItn calls...');
    const settled = await Promise.allSettled([1, 2].map(() => applyVerifiedPayfastItn(event)));
    console.log('Settled results:', JSON.stringify(settled, null, 2));

    const count = await paymentPrisma.ledgerJournal.count({
      where: { correlationId: payment.publicReference }
    });
    console.log('Count where correlationId === payment.publicReference:', count);
  } catch (err) {
    console.error('Error:', err);
  }
}

main().catch(err => console.error(err)).finally(() => paymentPrisma.$disconnect());
