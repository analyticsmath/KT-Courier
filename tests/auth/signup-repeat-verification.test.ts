import { test, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/signup/route';
const mock = vi.hoisted(() => ({ user:vi.fn(), send:vi.fn(), issue:vi.fn(), limit:vi.fn() }));
vi.mock('@/lib/db/prisma',()=>({prisma:{user:{findUnique:mock.user}}}));
vi.mock('@/lib/auth/password',()=>({hashPassword:async()=> 'hash'}));
vi.mock('@/lib/notifications/pending-verification-otp',()=>({issuePendingVerificationOtp:mock.issue}));
vi.mock('@/lib/notifications/security-email-delivery',()=>({deliverSecurityEmail:mock.send}));
vi.mock('@/lib/security/request-origin',()=>({enforceSameOriginRequest:async()=>null}));
vi.mock('@/lib/security/rate-limit',()=>({checkIpRateLimit:async()=>({ok:true}),checkAuthRateLimit:mock.limit,RATE_LIMITS:{SIGNUP:{},RESEND_OTP:{}}}));
vi.mock('@/lib/auth/security-email-readiness',async original=>({...await original(),securityEmailUnavailableResponse:()=>null}));
const req=()=>new NextRequest('http://localhost:3000/api/auth/signup',{method:'POST',headers:{'content-type':'application/json',origin:'http://localhost:3000'},body:JSON.stringify({accountType:'DRIVER',fullName:'Synthetic Driver',email:'synthetic@example.test',phone:'0123456789',password:'OnlyForTesting123!',confirmPassword:'OnlyForTesting123!'})});

test('repeated pending signup queues replacement verification without account enumeration',async()=>{
 vi.stubEnv('NODE_ENV','production');
 mock.user.mockResolvedValue({id:'testuser',status:'PENDING_VERIFICATION'});
 mock.limit.mockResolvedValue({ok:true});mock.issue.mockResolvedValue({deliveryId:'queued'});
 mock.send.mockResolvedValue({accepted:true});
 const r=await POST(req());expect(r.status).toBe(202);
 expect(mock.issue).toHaveBeenCalledOnce();expect(mock.send).toHaveBeenCalledWith('queued');
 expect(mock.limit).toHaveBeenCalledWith(expect.anything(),'resend-otp','synthetic@example.test',expect.anything());
 vi.unstubAllEnvs();
});

test('verified accounts return the same neutral response without sending a code',async()=>{
 vi.clearAllMocks();vi.stubEnv('NODE_ENV','production');
 mock.user.mockResolvedValue({id:'testuser',status:'ACTIVE'});
 mock.limit.mockResolvedValue({ok:true});
 const r=await POST(req());expect(r.status).toBe(202);
 expect((await r.json()).deliveryPending).toBe(true);
 expect(mock.issue).not.toHaveBeenCalled();expect(mock.send).not.toHaveBeenCalled();
 vi.unstubAllEnvs();
});

test('repeated signup cannot bypass the shared recipient rate limiter',async()=>{
 vi.clearAllMocks();vi.stubEnv('NODE_ENV','production');
 mock.user.mockResolvedValue({id:'testuser',status:'PENDING_VERIFICATION'});
 mock.limit.mockResolvedValue({ok:false,retryAfterSeconds:600});
 const r=await POST(req());expect(r.status).toBe(202);
 expect(mock.issue).not.toHaveBeenCalled();expect(mock.send).not.toHaveBeenCalled();
 vi.unstubAllEnvs();
});

test('transient issuance failure does not leak a registered account or fabricate delivery',async()=>{
 vi.clearAllMocks();vi.stubEnv('NODE_ENV','production');
 mock.user.mockResolvedValue({id:'testuser',status:'PENDING_VERIFICATION'});
 mock.limit.mockResolvedValue({ok:true});mock.issue.mockRejectedValue(new Error('transient outage'));
 const r=await POST(req());expect(r.status).toBe(202);
 expect((await r.json()).deliveryPending).toBe(true);
 expect(mock.send).not.toHaveBeenCalled();
 vi.unstubAllEnvs();
});
