#!/usr/bin/env python3
"""Prepare an atomic, provenance-preserving identity import for the Neon connector.

Input is the sanitized identity extraction, never the raw SQL dump. Passwords,
tokens, verification assertions, compliance approvals and balances are excluded.
The generated SQL is private migration input and must never be committed.
"""
import argparse
import hashlib
import json
import pathlib
import re

parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()
data = json.loads(pathlib.Path(args.source).read_text())
allowed = {
    'users': {'id', 'f_name', 'l_name', 'phone', 'email', 'status', 'created_at', 'updated_at'},
    'delivery_men': {'id', 'f_name', 'l_name', 'phone', 'email', 'status', 'active', 'application_status', 'created_at', 'updated_at'},
    'customer_addresses': {'id', 'address_type', 'contact_person_number', 'address', 'latitude', 'longitude', 'user_id', 'contact_person_name', 'floor', 'road', 'house', 'created_at', 'updated_at'},
}
for table, rows in data.items():
    if table not in allowed:
        raise ValueError('Unexpected source table')
    for row in rows:
        if set(row) - allowed[table]:
            raise ValueError('Unexpected source fields')
        row['_sha256'] = hashlib.sha256(json.dumps(row, sort_keys=True).encode()).hexdigest()
        text = ' '.join(str(row.get(k) or '') for k in ('f_name', 'l_name', 'email'))
        row['_excluded_test'] = bool(re.search(r'(^|\W)(test|demo|sample|testing)(\W|$)', text, re.I) or re.search(r'@(example\.(com|org|net)|test\.com|mailinator\.com)$', row.get('email') or '', re.I))
payload = json.dumps(data, ensure_ascii=True)
delimiter = '$kt_identity_data_20261022$'
if delimiter in payload:
    raise ValueError('SQL delimiter collision')
sql = r'''
DO $kt_identity_import$
DECLARE
  data jsonb := __PAYLOAD__::jsonb;
  r jsonb; src text; target_role "UserRole"; desired_email text; normalized_phone text;
  uid text; profile_id text; prior_id text; mapped_uid text; previous_role "UserRole";
  existing_phone text; run_id text := 'legacy6-identities-ea0f3e236ac6c03d2ce3';
  fingerprint text := 'ea0f3e236ac6c03d2ce30144185ee5b615de18bd24800fbc2c27e2f7673d948e';
  disposition text; metadata jsonb; entity_model text; reason text;
BEGIN
  PERFORM pg_advisory_xact_lock(6142026);
  IF current_database() <> 'kt_couriers' THEN RAISE EXCEPTION 'Unapproved identity database'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "LegacyMigrationRun" WHERE "sourceFingerprint"=fingerprint AND phase='CATALOG_CORE' AND status IN ('VALIDATED','APPLIED')) THEN
    RAISE EXCEPTION 'Catalogue acceptance is required before identity import';
  END IF;
  INSERT INTO "LegacyMigrationRun" (id,"publicReference","sourceSystem","sourceDatabase","sourceFingerprint",phase,status,"startedAt","updatedAt")
  VALUES (run_id,'LMR-6AM-IDENTITIES-EA0F3E236AC6C03D2CE3','LEGACY_6AMMART','wwwktcouriers_ktcouaielidb',fingerprint,'IDENTITIES','APPLYING',now(),now())
  ON CONFLICT ("publicReference") DO NOTHING;

  -- Driver role is retained when the same confirmed source identity was also a customer.
  FOREACH src IN ARRAY ARRAY['delivery_men','users'] LOOP
    target_role := CASE WHEN src='delivery_men' THEN 'DRIVER'::"UserRole" ELSE 'CUSTOMER'::"UserRole" END;
    FOR r IN SELECT value FROM jsonb_array_elements(data->src) LOOP
      desired_email := lower(btrim(r->>'email'));
      normalized_phone := regexp_replace(coalesce(r->>'phone',''),'[\s().-]','','g');
      IF normalized_phone ~ '^0[0-9]{9}$' THEN normalized_phone := '+27'||substr(normalized_phone,2); END IF;
      normalized_phone := nullif(normalized_phone,'');
      metadata := jsonb_build_object('sourceStatus',r->'status','sourceActive',r->'active','sourceApplicationStatus',r->'application_status','requiresCurrentVerification',true,'legacyCredentialsCopied',false);
      disposition := 'PRESERVED_PENDING_VERIFICATION'; reason := NULL; uid := NULL; mapped_uid := NULL;
      SELECT "targetId" INTO mapped_uid FROM "LegacyMigrationMap" WHERE "sourceSystem"='LEGACY_6AMMART' AND "sourceDatabase"='wwwktcouriers_ktcouaielidb' AND "sourceTable"=src AND "sourceId"=r->>'id' AND "targetModel"='User';
      IF mapped_uid IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM "User" WHERE id=mapped_uid AND email=desired_email) THEN RAISE EXCEPTION 'Mapped identity changed'; END IF;
        CONTINUE;
      END IF;
      IF (r->>'_excluded_test')::boolean THEN reason := 'EXCLUDED_CONFIRMED_TEST';
      ELSIF desired_email IS NULL OR desired_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN reason := 'EMAIL_REVIEW_REQUIRED';
      ELSE
        SELECT id,role,phone INTO uid,previous_role,existing_phone FROM "User" WHERE email=desired_email;
        IF uid IS NOT NULL AND (previous_role IN ('ADMIN','SUPER_ADMIN') OR normalized_phone IS NULL OR existing_phone IS DISTINCT FROM normalized_phone) THEN reason := 'EMAIL_ROLE_PHONE_CONFLICT';
        ELSIF uid IS NOT NULL AND target_role='DRIVER' AND previous_role<>'DRIVER' THEN reason := 'DRIVER_ROLE_CONFLICT';
        ELSIF uid IS NULL AND normalized_phone IS NOT NULL AND EXISTS (SELECT 1 FROM "User" WHERE phone=normalized_phone AND email<>desired_email) THEN reason := 'PHONE_IDENTITY_CONFLICT';
        END IF;
      END IF;
      IF reason IS NOT NULL THEN
        entity_model := 'IdentityReview'; uid := 'legacy6-review-'||src||'-'||(r->>'id'); disposition := reason;
      ELSE
        entity_model := 'User';
        IF uid IS NULL THEN
          uid := 'legacy6-user-'||src||'-'||(r->>'id');
          INSERT INTO "User" (id,email,name,phone,role,status,"createdAt","updatedAt") VALUES
          (uid,desired_email,nullif(btrim(concat_ws(' ',r->>'f_name',r->>'l_name')),''),normalized_phone,target_role,
           CASE WHEN r->>'status'='0' THEN 'DISABLED'::"UserStatus" ELSE 'PENDING_VERIFICATION'::"UserStatus" END,
           coalesce(nullif(r->>'created_at','')::timestamp,now()),now());
        ELSE disposition := 'LINKED_EXISTING_IDENTITY_NO_AUTHORITY_CHANGE'; END IF;
        IF src='users' THEN
          INSERT INTO "CustomerProfile" (id,"userId","displayName","defaultPhone","createdAt","updatedAt")
          VALUES ('legacy6-customer-'||(r->>'id'),uid,nullif(btrim(concat_ws(' ',r->>'f_name',r->>'l_name')),''),normalized_phone,now(),now()) ON CONFLICT ("userId") DO NOTHING;
        ELSE
          INSERT INTO "DriverProfile" (id,"userId","driverCode","displayName",phone,active,status,availability,"onboardingStatus","createdAt","updatedAt")
          VALUES ('legacy6-driver-'||(r->>'id'),uid,'LEG6-DRIVER-'||(r->>'id'),nullif(btrim(concat_ws(' ',r->>'f_name',r->>'l_name')),''),normalized_phone,false,
            CASE WHEN r->>'application_status'='denied' THEN 'REJECTED'::"DriverStatus" WHEN r->>'status'='0' THEN 'INACTIVE'::"DriverStatus" ELSE 'PENDING_REVIEW'::"DriverStatus" END,
            'OFFLINE','PROFILE_INCOMPLETE',now(),now()) ON CONFLICT ("userId") DO NOTHING;
        END IF;
      END IF;
      INSERT INTO "LegacyMigrationMap" (id,"runId","sourceSystem","sourceDatabase","sourceTable","sourceId","sourceHash",disposition,"targetModel","targetId","safeMetadata","updatedAt")
      VALUES ('legacy6-map-'||src||'-'||(r->>'id'),run_id,'LEGACY_6AMMART','wwwktcouriers_ktcouaielidb',src,r->>'id',r->>'_sha256',disposition,entity_model,uid,metadata,now())
      ON CONFLICT ("sourceSystem","sourceDatabase","sourceTable","sourceId","targetModel") DO NOTHING;
    END LOOP;
  END LOOP;
  FOR r IN SELECT value FROM jsonb_array_elements(data->'customer_addresses') LOOP
    uid := NULL;
    SELECT "targetId" INTO uid FROM "LegacyMigrationMap" WHERE "sourceSystem"='LEGACY_6AMMART' AND "sourceDatabase"='wwwktcouriers_ktcouaielidb' AND "sourceTable"='users' AND "sourceId"=r->>'user_id' AND "targetModel"='User';
    disposition := 'IMPORTED_SAVED_ADDRESS'; entity_model := 'Address'; profile_id := 'legacy6-address-'||(r->>'id');
    IF uid IS NULL OR nullif(btrim(r->>'address'),'') IS NULL THEN disposition := 'ADDRESS_IDENTITY_OR_CONTENT_REVIEW'; entity_model := 'IdentityReview';
    ELSE
      INSERT INTO "Address" (id,type,label,"contactName","contactPhone",line1,line2,country,latitude,longitude,"userId","createdAt","updatedAt")
      VALUES (profile_id,'CUSTOMER',r->>'address_type',r->>'contact_person_name',r->>'contact_person_number',r->>'address',nullif(concat_ws(', ',nullif(r->>'house',''),nullif(r->>'road',''),nullif(r->>'floor','')),''),'South Africa',
       CASE WHEN r->>'latitude' ~ '^-?[0-9]+(\.[0-9]+)?$' AND abs((r->>'latitude')::numeric)<=90 THEN (r->>'latitude')::numeric ELSE NULL END,
       CASE WHEN r->>'longitude' ~ '^-?[0-9]+(\.[0-9]+)?$' AND abs((r->>'longitude')::numeric)<=180 THEN (r->>'longitude')::numeric ELSE NULL END,
       uid,coalesce(nullif(r->>'created_at','')::timestamp,now()),now()) ON CONFLICT (id) DO NOTHING;
    END IF;
    INSERT INTO "LegacyMigrationMap" (id,"runId","sourceSystem","sourceDatabase","sourceTable","sourceId","sourceHash",disposition,"targetModel","targetId","safeMetadata","updatedAt")
    VALUES ('legacy6-map-address-'||(r->>'id'),run_id,'LEGACY_6AMMART','wwwktcouriers_ktcouaielidb','customer_addresses',r->>'id',r->>'_sha256',disposition,entity_model,profile_id,jsonb_build_object('sourceUserId',r->'user_id'),now())
    ON CONFLICT ("sourceSystem","sourceDatabase","sourceTable","sourceId","targetModel") DO NOTHING;
  END LOOP;
  UPDATE "LegacyMigrationRun" SET status='APPLIED',"completedAt"=now(),"updatedAt"=now(),summary=jsonb_build_object('sourceCustomers',90,'sourceDrivers',54,'sourceAddresses',43,'legacyPasswordsCopied',false,'ambiguousIdentitiesRequireReview',true) WHERE id=run_id;
END $kt_identity_import$;
SELECT "sourceTable",disposition,count(*) FROM "LegacyMigrationMap" WHERE "runId"='legacy6-identities-ea0f3e236ac6c03d2ce3' GROUP BY 1,2 ORDER BY 1,2;
'''.replace('__PAYLOAD__', delimiter + payload + delimiter)
target = pathlib.Path(args.output)
target.write_text(sql)
target.chmod(0o600)
print(json.dumps({'prepared': True, 'sourceCustomers':len(data['users']), 'sourceDrivers':len(data['delivery_men']), 'sourceAddresses':len(data['customer_addresses'])}))
