-- AlterEnum
ALTER TYPE "PrivateMediaOwnerType" ADD VALUE 'USER';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarMediaReference" TEXT;

-- AlterTable
ALTER TABLE "PromotionCampaignVersion" ADD COLUMN     "clientDraftRevision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "proposedBudgetAmount" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "PaymentMethodPolicy" ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "provinceScope" JSONB,
ADD COLUMN     "regionId" TEXT;

-- CreateTable
CREATE TABLE "StoreEmployeeMembership" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "roleLabel" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "inviteTokenHash" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "invitedByUserId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreEmployeeMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformConversation" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "orderId" TEXT,
    "storeId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformConversationMember" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "PlatformConversationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformConversationMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryReview" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "storeId" TEXT,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "response" TEXT,
    "respondedByUserId" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverCashDeposit" (
    "id" TEXT NOT NULL,
    "driverProfileId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "bankReference" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverCashDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessSupportAccess" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessSupportAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreEmployeeMembership_inviteTokenHash_key" ON "StoreEmployeeMembership"("inviteTokenHash");

-- CreateIndex
CREATE INDEX "StoreEmployeeMembership_userId_status_idx" ON "StoreEmployeeMembership"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StoreEmployeeMembership_storeId_email_key" ON "StoreEmployeeMembership"("storeId", "email");

-- CreateIndex
CREATE INDEX "PlatformConversation_storeId_kind_idx" ON "PlatformConversation"("storeId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformConversation_orderId_kind_key" ON "PlatformConversation"("orderId", "kind");

-- CreateIndex
CREATE INDEX "PlatformConversationMember_userId_idx" ON "PlatformConversationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformConversationMember_conversationId_userId_key" ON "PlatformConversationMember"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "PlatformConversationMessage_conversationId_createdAt_id_idx" ON "PlatformConversationMessage"("conversationId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformConversationMessage_conversationId_senderUserId_ope_key" ON "PlatformConversationMessage"("conversationId", "senderUserId", "operationId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryReview_orderId_key" ON "DeliveryReview"("orderId");

-- CreateIndex
CREATE INDEX "DeliveryReview_authorUserId_createdAt_idx" ON "DeliveryReview"("authorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "DeliveryReview_storeId_createdAt_idx" ON "DeliveryReview"("storeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DriverCashDeposit_operationId_key" ON "DriverCashDeposit"("operationId");

-- CreateIndex
CREATE INDEX "DriverCashDeposit_driverProfileId_status_createdAt_idx" ON "DriverCashDeposit"("driverProfileId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DriverCashDeposit_orderId_status_idx" ON "DriverCashDeposit"("orderId", "status");

-- CreateIndex
CREATE INDEX "BusinessSupportAccess_storeId_createdAt_idx" ON "BusinessSupportAccess"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessSupportAccess_actorUserId_createdAt_idx" ON "BusinessSupportAccess"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "StoreEmployeeMembership" ADD CONSTRAINT "StoreEmployeeMembership_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreEmployeeMembership" ADD CONSTRAINT "StoreEmployeeMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformConversation" ADD CONSTRAINT "PlatformConversation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformConversation" ADD CONSTRAINT "PlatformConversation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformConversationMember" ADD CONSTRAINT "PlatformConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "PlatformConversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformConversationMember" ADD CONSTRAINT "PlatformConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformConversationMessage" ADD CONSTRAINT "PlatformConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "PlatformConversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformConversationMessage" ADD CONSTRAINT "PlatformConversationMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryReview" ADD CONSTRAINT "DeliveryReview_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryReview" ADD CONSTRAINT "DeliveryReview_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryReview" ADD CONSTRAINT "DeliveryReview_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverCashDeposit" ADD CONSTRAINT "DriverCashDeposit_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverCashDeposit" ADD CONSTRAINT "DriverCashDeposit_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessSupportAccess" ADD CONSTRAINT "BusinessSupportAccess_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessSupportAccess" ADD CONSTRAINT "BusinessSupportAccess_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Fail closed on invalid access records and prevent ambiguous business identity.
ALTER TABLE "StoreEmployeeMembership" ADD CONSTRAINT "employee_membership_valid" CHECK (
 "status" IN ('INVITED','ACTIVE','DISABLED','REMOVED') AND jsonb_typeof("permissions") = 'array'
 AND "email" = lower(trim("email")) AND ("status" <> 'ACTIVE' OR "userId" IS NOT NULL)
);
CREATE UNIQUE INDEX "one_active_business_per_employee" ON "StoreEmployeeMembership"("userId") WHERE "status" = 'ACTIVE';
ALTER TABLE "PlatformConversation" ADD CONSTRAINT "platform_conversation_kind_valid" CHECK (
 "kind" IN ('DELIVERY','SUPPORT') AND ("kind" <> 'DELIVERY' OR "orderId" IS NOT NULL)
);
ALTER TABLE "PlatformConversationMessage" ADD CONSTRAINT "platform_message_length_valid" CHECK (length(trim("body")) BETWEEN 1 AND 4000);
ALTER TABLE "DeliveryReview" ADD CONSTRAINT "delivery_review_valid" CHECK ("rating" BETWEEN 1 AND 5 AND length("body") <= 2000 AND length(coalesce("response",'')) <= 2000);
ALTER TABLE "DriverCashDeposit" ADD CONSTRAINT "driver_cash_deposit_valid" CHECK ("amount" > 0 AND "status" IN ('PENDING','PROCESSING','CONFIRMED','REJECTED'));
CREATE UNIQUE INDEX "one_pending_cash_deposit_per_order" ON "DriverCashDeposit"("orderId") WHERE "status" IN ('PENDING','PROCESSING');
ALTER TABLE "BusinessSupportAccess" ADD CONSTRAINT "business_support_reason_valid" CHECK (length(trim("reason")) BETWEEN 10 AND 1000);
