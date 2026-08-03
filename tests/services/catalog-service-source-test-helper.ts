import { readFileSync } from "node:fs"; import path from "node:path";
export function serviceSource(name:string){return readFileSync(path.join(process.cwd(),"lib/services",name),"utf8")}
export function expectTransactionalEvidence(source:string){if(!/\$transaction/.test(source)||!/recordCatalogEvidence/.test(source))throw new Error("Service must write state and catalog evidence transactionally.")}

