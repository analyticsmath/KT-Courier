import { requireRole } from "@/lib/auth/guards";
import { UserRole } from "@/types/db";
import { prisma } from "@/lib/db/prisma";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { SuperAdminCommerceDesk } from "@/components/admin/SuperAdminCommerceDesk";

export const dynamic = "force-dynamic";
export default async function SuperAdminPage() {
  await requireRole(UserRole.SUPER_ADMIN);
  const [stores, types, categories, products, offers] = await Promise.all([
    prisma.store.findMany({where:{status:{in:["ACTIVE","PENDING"]}},select:{id:true,name:true,status:true},orderBy:{name:"asc"},take:150}),
    prisma.productTypeDefinition.findMany({where:{status:{in:["APPROVED","ACTIVE"]}},select:{id:true,name:true},orderBy:{name:"asc"},take:150}),
    prisma.catalogCategory.findMany({where:{status:"ACTIVE"},select:{id:true,path:true},orderBy:{path:"asc"},take:150}),
    prisma.catalogProduct.findMany({where:{scope:"STORE_PRIVATE",sourceStoreId:{not:null}},select:{id:true,publicReference:true,version:true,title:true,sourceStoreId:true,variants:{select:{id:true,title:true,status:true}}},orderBy:{updatedAt:"desc"},take:300}),
    prisma.storeCatalogOffer.findMany({select:{id:true,storeId:true,storeSku:true,publicReference:true,version:true,product:{select:{title:true}},variant:{select:{title:true}}},orderBy:{updatedAt:"desc"},take:300}),
  ]);
  return <ProtectedPageFrame>
    <ProtectedPageHeader title="Super Admin commerce" description="Onboard stores, create catalog and price drafts, review operations and initiate secure account recovery." />
    <SuperAdminCommerceDesk stores={stores} types={types} categories={categories} products={products} offers={offers}/>
  </ProtectedPageFrame>;
}
