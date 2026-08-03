import { PrismaClient } from "@prisma/client";
import { createSession } from "../lib/auth/session.js";

const prisma = new PrismaClient();

async function checkAccount(email, path) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`❌ User not found for ${email}`);
    return false;
  }
  const token = await createSession(user.id);
  const res = await fetch(`http://localhost:3000${path}`, {
    headers: { cookie: `kt_session=${token}` },
    redirect: "manual",
  });
  console.log(`[${user.role}] ${email} -> ${path} => HTTP ${res.status}`);
  return res.status === 200;
}

async function main() {
  console.log("Checking dashboard authentication & rendering...");
  await checkAccount("customer@ktcouriers.local", "/account");
  await checkAccount("store@ktcouriers.local", "/store");
  await checkAccount("driver1@ktcouriers.local", "/driver");
  await checkAccount("promoter@ktcouriers.local", "/promoter");
  await checkAccount("applicant@ktcouriers.local", "/applicant");
  await checkAccount("admin@ktcouriers.local", "/admin");
  await checkAccount("developer@ktcouriers.local", "/developers/applications");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
