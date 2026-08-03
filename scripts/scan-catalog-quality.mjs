import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main(){const rows=await prisma.$queryRaw`SELECT "publicReference","qualityScore","qualityIssues" FROM "CatalogProduct" WHERE "status"::text<>'ARCHIVED' ORDER BY "qualityScore" ASC LIMIT 500`;const summary={scanned:rows.length,below60:rows.filter((row)=>Number(row.qualityScore)<60).length,zero:rows.filter((row)=>Number(row.qualityScore)===0).length};console.log(JSON.stringify(summary,null,2));if(summary.zero)process.exitCode=1}
try{await main()}catch(error){console.error(error instanceof Error?error.message:"Catalog quality scan failed.");process.exitCode=1}finally{await prisma.$disconnect()}

