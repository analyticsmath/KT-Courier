import { prisma } from "../lib/db/prisma";
import { INITIAL_DELIVERY } from "../lib/client-platform/initial-delivery";
import { saveDeliveryConfiguration } from "../lib/client-platform/delivery.service";
async function main(){const actor=await prisma.user.findFirst({where:{role:"SUPER_ADMIN",status:"ACTIVE"},select:{id:true}});if(!actor)throw new Error("Active superuser required for audited initialization");for(const input of INITIAL_DELIVERY){if(await prisma.deliveryServiceDefinition.findFirst({where:{stableKey:input.stableKey},select:{id:true}}))continue;await saveDeliveryConfiguration(actor.id,input);console.log(`Initialized ${input.stableKey}`);}}
main().catch(e=>{console.error(e instanceof Error?e.message:"Initialization failed");process.exitCode=1;}).finally(()=>prisma.$disconnect());
