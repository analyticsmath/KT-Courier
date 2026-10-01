import { prisma } from "@/lib/db/prisma";
import { requireBusinessPage } from "@/lib/client-platform/business-auth";
import { BusinessEmployees, type BusinessEmployee } from "@/components/forms/BusinessEmployees";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
export default async function Page() {
  const a=await requireBusinessPage("/store/employees");
  const employees=await prisma.storeEmployeeMembership.findMany({where:{storeId:a.store.id,status:{not:"REMOVED"}},select:{id:true,email:true,roleLabel:true,permissions:true,status:true,inviteExpiresAt:true},orderBy:{createdAt:"desc"}});
  const initialEmployees=employees.map(e=>({...e,permissions:e.permissions as BusinessEmployee["permissions"],inviteExpiresAt:e.inviteExpiresAt?.toISOString()??null}));
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Business access"
        title="Employees"
        description="Invite team members and assign only the modules they need."
      />
      <OperationalPanel title="Team access">
        <BusinessEmployees initialEmployees={initialEmployees} />
      </OperationalPanel>
    </ProtectedPageFrame>
  );
}
