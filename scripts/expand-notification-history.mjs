import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("=========================================================================");
  console.log("      KT COURIERS REALISTIC NOTIFICATION HISTORY GENERATION              ");
  console.log("=========================================================================\n");

  const categories = [
    { key: "orders", purpose: "TRANSACTIONAL", name: "Courier Orders" },
    { key: "dispatch", purpose: "OPERATIONAL", name: "Driver Dispatch" },
    { key: "delivery", purpose: "OPERATIONAL", name: "Parcel Delivery" },
    { key: "payments", purpose: "FINANCIAL", name: "Payment Receipts" },
    { key: "refunds", purpose: "FINANCIAL", name: "Refund Confirmations" },
    { key: "withdrawals", purpose: "FINANCIAL", name: "Withdrawals & Payouts" },
    { key: "subscriptions", purpose: "BILLING", name: "Store Subscriptions" },
    { key: "promotions", purpose: "MARKETING", name: "Promotions & Discounts" },
    { key: "advertising", purpose: "COMMERCIAL", name: "Ad Campaign Activity" },
    { key: "drivers", purpose: "OPERATIONAL", name: "Driver Operations" },
    { key: "stores", purpose: "MERCHANT", name: "Store Management" },
    { key: "promoters", purpose: "COMMISSION", name: "Promoter Earnings" },
    { key: "recruitment", purpose: "HIRING", name: "Job Applications & Hiring" },
    { key: "developer_api", purpose: "SYSTEM", name: "Developer API & Webhooks" },
    { key: "reports", purpose: "SYSTEM", name: "Report Export Ready" },
    { key: "security", purpose: "SECURITY", name: "Account Security Alerts" },
  ];

  for (const cat of categories) {
    const catPublicRef = `PUB-NCAT-${cat.key.toUpperCase()}`;
    await prisma.notificationCategory.upsert({
      where: { key: cat.key },
      update: {
        publicReference: catPublicRef,
        purpose: "TRANSACTIONAL",
      },
      create: {
        publicReference: catPublicRef,
        key: cat.key,
        purpose: "TRANSACTIONAL",
        defaultPriority: "NORMAL",
        defaultSensitivity: "ACCOUNT",
      },
    });
  }

  const users = await prisma.user.findMany();
  const customerUsers = users.filter((u) => u.role === "CUSTOMER");
  const driverUsers = users.filter((u) => u.role === "DRIVER");
  const storeUsers = users.filter((u) => u.role === "STORE");
  const promoterUsers = users.filter((u) => u.role === "PROMOTER");
  const adminUsers = users.filter((u) => u.role === "ADMIN" || u.role === "SUPER_ADMIN");

  const channels = ["IN_APP", "EMAIL", "SMS", "PUSH"];
  const statuses = [
    "DELIVERED",
    "PENDING",
    "QUEUED",
    "ELIGIBILITY_BLOCKED",
    "FAILED_RETRYABLE",
    "FAILED_PERMANENT",
  ];
  const inboxStates = ["UNREAD", "READ", "ARCHIVED"];

  const notificationRecords = [];
  const now = new Date();

  function getRandomDateInLastMonths(monthsAgo) {
    const d = new Date();
    d.setMonth(d.getMonth() - monthsAgo);
    d.setDate(Math.floor(Math.random() * 28) + 1);
    d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
    return d;
  }

  let notificationCount = 0;

  for (let m = 0; m < 6; m++) {
    for (const cat of categories) {
      const countForMonth = 8;
      for (let i = 0; i < countForMonth; i++) {
        const occurredAt = getRandomDateInLastMonths(m);
        const channel = channels[(notificationCount + i) % channels.length];
        const status = statuses[(notificationCount + i) % statuses.length];
        const inboxState = inboxStates[(notificationCount + i) % inboxStates.length];

        let targetUser = customerUsers[i % customerUsers.length];
        let role = "CUSTOMER";

        if (["dispatch", "drivers"].includes(cat.key)) {
          targetUser = driverUsers[i % driverUsers.length] || targetUser;
          role = "DRIVER";
        } else if (["stores", "subscriptions", "advertising"].includes(cat.key)) {
          targetUser = storeUsers[i % storeUsers.length] || targetUser;
          role = "STORE";
        } else if (["promoters"].includes(cat.key)) {
          targetUser = promoterUsers[i % promoterUsers.length] || targetUser;
          role = "PROMOTER";
        } else if (["developer_api", "reports", "security"].includes(cat.key)) {
          targetUser = adminUsers[i % adminUsers.length] || targetUser;
          role = "ADMIN";
        }

        if (!targetUser) continue;

        const sourceEventId = `evt-${cat.key}-${m}-${i}-${targetUser.id.substring(0, 8)}`;
        const sourceReceiptId = `nsr-${cat.key}-${m}-${i}`;
        const messageId = `nm-${cat.key}-${m}-${i}`;
        const deliveryId = `nd-${cat.key}-${m}-${i}`;
        const inboxId = `nii-${cat.key}-${m}-${i}`;

        await prisma.notificationSourceReceipt.upsert({
          where: { sourceAuthority_sourceEventId: { sourceAuthority: "KT_EVENT_BUS", sourceEventId } },
          update: {},
          create: {
            id: sourceReceiptId,
            publicReference: `PUB-NSR-${sourceEventId}`,
            sourceAuthority: "KT_EVENT_BUS",
            sourceEventId,
            sourceEventType: `${cat.key.toUpperCase()}_EVENT`,
            aggregateReference: `agg-${cat.key}-${i}`,
            payloadHash: crypto.createHash("sha256").update(sourceEventId).digest("hex"),
            occurredAt,
            status: "PROCESSED",
            createdAt: occurredAt,
          },
        });

        await prisma.notificationMessage.upsert({
          where: { dedupeKey: `dedupe-${cat.key}-${m}-${i}` },
          update: {},
          create: {
            id: messageId,
            publicReference: `PUB-NM-${messageId}`,
            dedupeKey: `dedupe-${cat.key}-${m}-${i}`,
            sourceReceiptId,
            recipientUserId: targetUser.id,
            categoryKey: cat.key,
            routeVersionId: `nrv-v1-${cat.key}`,
            templateVersionId: `ntv-v1-${cat.key}`,
            recipientPolicyVersionId: `npv-v1-${cat.key}`,
            purpose: "TRANSACTIONAL",
            priority: "NORMAL",
            sensitivity: "ACCOUNT",
            renderVariablesHash: crypto.createHash("sha256").update(messageId).digest("hex"),
            status: "FANOUT_COMPLETED",
            createdAt: occurredAt,
          },
        });

        await prisma.notificationRecipient.upsert({
          where: { messageId_subjectUserId: { messageId, subjectUserId: targetUser.id } },
          update: {},
          create: {
            id: `nr-${messageId}`,
            messageId,
            subjectUserId: targetUser.id,
            roleProjection: role,
            createdAt: occurredAt,
          },
        });

        await prisma.notificationDelivery.upsert({
          where: { messageId_channel: { messageId, channel } },
          update: {},
          create: {
            id: deliveryId,
            publicReference: `PUB-ND-${deliveryId}`,
            messageId,
            recipientUserId: targetUser.id,
            channel,
            status,
            renderedTitle: `${cat.name} Update`,
            renderedBody: `Your ${cat.name} event reference ${sourceEventId} has been updated.`,
            createdAt: occurredAt,
          },
        });

        if (channel === "IN_APP") {
          await prisma.notificationInboxItem.upsert({
            where: { messageId },
            update: {},
            create: {
              id: inboxId,
              publicReference: `PUB-NII-${inboxId}`,
              messageId,
              ownerUserId: targetUser.id,
              title: `${cat.name} Update`,
              body: `Your ${cat.name} event reference ${sourceEventId} has been updated.`,
              state: inboxState,
              readAt: inboxState === "READ" ? occurredAt : null,
              archivedAt: inboxState === "ARCHIVED" ? occurredAt : null,
              createdAt: occurredAt,
            },
          });
        }

        await prisma.notification.create({
          data: {
            id: `legacy-${messageId}`,
            userId: targetUser.id,
            channel: channel === "IN_APP" ? "IN_APP" : channel === "EMAIL" ? "EMAIL" : channel === "SMS" ? "SMS" : "PUSH",
            status: status === "DELIVERED" ? "DELIVERED" : status === "FAILED_PERMANENT" ? "FAILED" : "SENT",
            eventType: `${cat.key.toUpperCase()}_EVENT`,
            title: `${cat.name} Update`,
            body: `Your ${cat.name} event reference ${sourceEventId} has been updated.`,
            createdAt: occurredAt,
          },
        });

        notificationRecords.push({
          id: messageId,
          category: cat.key,
          channel,
          status,
          recipientRole: role,
          month: `${occurredAt.getFullYear()}-${String(occurredAt.getMonth() + 1).padStart(2, "0")}`,
        });

        notificationCount++;
      }
    }
  }

  const totalNotifications = notificationRecords.length;

  const countByCategory = {};
  const countByChannel = {};
  const countByStatus = {};
  const countByRole = {};
  const countByMonth = {};

  for (const r of notificationRecords) {
    countByCategory[r.category] = (countByCategory[r.category] || 0) + 1;
    countByChannel[r.channel] = (countByChannel[r.channel] || 0) + 1;
    countByStatus[r.status] = (countByStatus[r.status] || 0) + 1;
    countByRole[r.recipientRole] = (countByRole[r.recipientRole] || 0) + 1;
    countByMonth[r.month] = (countByMonth[r.month] || 0) + 1;
  }

  console.log("\n========================================================");
  console.log("       NOTIFICATION HISTORY EXPANSION REPORT           ");
  console.log("========================================================");
  console.log(`Total Expanded Notifications:     ${totalNotifications}\n`);
  console.log("📌 Breakdown by Category (16/16 Categories):");
  console.table(countByCategory);

  console.log("📌 Breakdown by Channel:");
  console.table(countByChannel);

  console.log("📌 Breakdown by Status:");
  console.table(countByStatus);

  console.log("📌 Breakdown by Recipient Role:");
  console.table(countByRole);

  console.log("📌 Breakdown by Month:");
  console.table(countByMonth);
  console.log("========================================================\n");

  fs.writeFileSync(
    path.join(process.cwd(), "docs/notification-history-breakdown.json"),
    JSON.stringify(
      {
        generatedAt: now.toISOString(),
        totalNotifications,
        countByCategory,
        countByChannel,
        countByStatus,
        countByRole,
        countByMonth,
      },
      null,
      2
    )
  );

  console.log("Saved notification history breakdown to docs/notification-history-breakdown.json");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
