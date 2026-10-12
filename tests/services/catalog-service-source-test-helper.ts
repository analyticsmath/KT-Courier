import { readFileSync } from "node:fs"; import path from "node:path";
export function serviceSource(name:string){return readFileSync(path.join(process.cwd(),"lib/services",name),"utf8")}
export function expectTransactionalEvidence(source:string){
  const direct = /\$transaction/.test(source);
  const composed = /withCatalogTransaction\(transaction,/.test(source)
    && /withCatalogTransaction/.test(source)
    && /return transaction \? work\(transaction\) : prisma\.\$transaction\(work, options\)/.test(serviceSource("catalog-service-support.ts"));
  if((!direct && !composed)||!/recordCatalogEvidence/.test(source))throw new Error("Service must write state and catalog evidence transactionally.");
}
