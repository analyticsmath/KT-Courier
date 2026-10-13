# Railway staged patch decision

Decision: **LEAVE STAGED / BLOCKED**. No patch was accepted or discarded, and no production variable or service was changed. A fresh read-only provider read on 2026-10-13 UTC supersedes the older staged-patch receipt in this repository.

## Current production readback

- Project: `KT Courier Production` (`e9554aaa-1b53-4595-8731-e8c2885ac594`)
- Environment: `production` (`2226be2a-86f7-4590-a7b4-72aa54dccf52`)
- Patch: `9a3370a3-8d07-4ef9-9e8d-a57ff488fccb`, status `STAGED`, one change, marked destructive
- Exact staged change: delete live service `admin-replacement-inspection` (`b00116f6-3bc9-4d90-96dd-2bb17149c6fd`); live deployment `6870b652-4c7d-447d-acd9-2531fade6ffe` is `SUCCESS`
- The fresh staged diff contains no `paystack-credential-test` creation and no deletion of `query-storefront-categories`.

The other live Railway services also reported `SUCCESS`: `web` (`55254aaf-3719-4da9-a5b6-9214417101c6`, deployment `49ffb172-42d5-4086-a817-0f2fed078c94`), `query-storefront-categories` (`fdd13e91-dffa-400e-9a44-ae2d1f891ff0`, deployment `b3661083-45e7-48be-9782-2cefcc62bef3`), `Postgres` (`85d40ee8-2135-4e18-a573-0e4d67483e04`, deployment `9324de4d-e667-e45b-8233-32181fa26ec8`) and `Redis` (`288108fd-cdd8-4548-bdf1-48400ecc0f40`, deployment `9ab83cf2-455b-457c-a26d-6408a5dbcf54`). This health read does not certify customer checkout, payments, route coverage or delivery operations.

Vercel production remains on `main` at commit `8b7844b3d30416bbee944381073c72926a1f4216` with a `READY` deployment. The current GitHub candidate has not been deployed to production.

## Required handling

An infrastructure owner must inspect the exact current patch in Railway before taking any action. If the provider permits discarding only the staged deletion while preserving the healthy live service, that exact removal may be reviewed and performed by the owner. Never accept/deploy this patch. If selective discard is unavailable or the diff has changed, leave it staged and obtain Railway owner/support guidance. Do not use the prior five-change receipt as the basis for a production mutation.

Re-read and retain a redacted receipt after any owner-approved discard. It must show that the staged deletion is absent and that the `admin-replacement-inspection` service, configuration, deployment and health remain intact. Keep the older dated receipts as historical evidence only; they do not describe this fresh patch scope.
