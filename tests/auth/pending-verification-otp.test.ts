import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { issuePendingVerificationOtp } from '@/lib/notifications/pending-verification-otp';
const state=vi.hoisted(()=>({
 transaction:vi.fn(),lookup:vi.fn(),lock:vi.fn(),replace:vi.fn(),create:vi.fn(),queue:vi.fn(),
}));
vi.mock('@/lib/db/prisma',()=>({prisma:{$transaction:state.transaction}}));
vi.mock('@/lib/notifications/security-delivery',()=>({queueSecurityNotification:state.queue}));
vi.mock('@/lib/auth/security-email-readiness',()=>({shouldQueueSecurityEmail:()=>true}));
vi.mock('@/lib/auth/otp',()=>({generateOtpCode:()=> '654321', hashOtp:()=> 'hashed-test-code',otpExpiresAt:()=>new Date('2030-01-01T00:00:00Z')}));

describe('pending verification replacement atomic authority',()=>{
 beforeEach(()=>{
  vi.clearAllMocks();vi.stubEnv('NODE_ENV','production');
  state.lookup.mockResolvedValue({id:'user-1',name:'Example',status:'PENDING_VERIFICATION'});
  state.create.mockResolvedValue({id:'new-code',expiresAt:new Date('2030-01-01T00:00:00Z')});
  state.queue.mockResolvedValue({delivery:{id:'secure-delivery'}});
  const tx={$queryRaw:state.lock,user:{findUnique:state.lookup},otpCode:{updateMany:state.replace,create:state.create}};
  state.transaction.mockImplementation(async cb=>cb(tx));
 });
 afterEach(()=>vi.unstubAllEnvs());
 it('locks the account, replaces prior codes, and durably queues encrypted notification',async()=>{
  const result=await issuePendingVerificationOtp('synthetic@example.test');
  expect(result).toMatchObject({eligible:true,deliveryId:'secure-delivery'});
  expect(state.lock).toHaveBeenCalledOnce();
  expect(state.replace).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({consumedAt:null})}));
  expect(state.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({codeHash:'hashed-test-code'})}));
  expect(state.queue).toHaveBeenCalledWith(expect.objectContaining({eventType:'EMAIL_VERIFICATION_OTP',operationId:'email-verification:new-code'}),expect.anything());
 });
 it.each(['ACTIVE','SUSPENDED','REJECTED'])('never generates a code for a %s account',async status=>{
  state.lookup.mockResolvedValue({id:'user-1',name:'Example',status});
  expect((await issuePendingVerificationOtp('synthetic@example.test')).eligible).toBe(false);
  expect(state.replace).not.toHaveBeenCalled();expect(state.queue).not.toHaveBeenCalled();
 });
 it('rolls back the transaction when encrypted email persistence fails',async()=>{
  state.queue.mockRejectedValue(new Error('persistence-failed'));
  await expect(issuePendingVerificationOtp('synthetic@example.test')).rejects.toThrow('persistence-failed');
  expect(state.create).toHaveBeenCalledOnce();
  // The account update, new code and secure message use a single DB transaction.
  expect(state.transaction).toHaveBeenCalledOnce();
 });
});
