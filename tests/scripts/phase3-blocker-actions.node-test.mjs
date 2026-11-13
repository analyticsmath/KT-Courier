import { test } from "node:test";
import assert from "node:assert/strict";
import { PHASE3_REMEDIATION, buildPhase3BlockerReport } from "../../scripts/report-phase3-blockers.mjs";
import { exactCertificationSourceMatches } from "../../scripts/check-closure-engineering-gates.mjs";
const sha="a090c77d564b5e04c3f3e12fc020bcacaab2808e";
function manifest() {return {classification:"NOT_READY",gates:[
  {key:"commercial_financial_certification",status:"VALIDATION_BLOCKED",evidence:"Human finance missing."},
  {key:"notification_required_domains",status:"OPEN",evidence:"Delivery unavailable."},
  {key:"parcel_profile_configuration",status:"IMPLEMENTED",evidence:"Verified profile."}
]};}
test("all nine launch blockers have accountable action sets",()=>{
  assert.equal(Object.keys(PHASE3_REMEDIATION).length,9);
  for(const entry of Object.values(PHASE3_REMEDIATION)){
    assert.ok(entry.accountable && entry.kind && entry.evidence && entry.actions.length>=2);
  }
});
test("report never turns external approval into launch or automated certification",()=>{
  const r=buildPhase3BlockerReport(manifest(),{sourceSha:sha,expectedSha:sha});
  assert.equal(r.sourceMatches,true);
  assert.equal(r.unresolvedCount,2);
  assert.equal(r.totalGates,3);
  assert.equal(r.launchAuthorization,"NOT_EVALUATED");
  assert.equal(r.automatedEngineeringCertification,"NOT_EVALUATED");
  assert.ok(!r.gateActions.some(x=>x.key==="parcel_profile_configuration"));
});
test("missing and incomplete exact commit SHAs refuse source matching",()=>{
  assert.equal(exactCertificationSourceMatches(sha,sha),true);
  assert.equal(exactCertificationSourceMatches(null,null),false);
  assert.equal(exactCertificationSourceMatches(sha,null),false);
  assert.equal(exactCertificationSourceMatches(sha.slice(0,8),sha.slice(0,8)),false);
  assert.equal(buildPhase3BlockerReport(manifest(),{sourceSha:sha}).sourceMatches,false);
});
test("unrecognized future blocked gate receives a conservative owner",()=>{
  const m=manifest();m.gates.push({key:"other_future_gate",status:"OPEN",evidence:"New independent approval."});
  const r=buildPhase3BlockerReport(m,{sourceSha:sha,expectedSha:sha});
  assert.equal(r.gateActions.at(-1).kind,"UNCATEGORIZED_REQUIRES_INDEPENDENT_REVIEW");
});
test("duplicate or evidence-free gate refuses diagnostic acceptance",()=>{
  const m=manifest();m.gates.push({...m.gates[0]});
  assert.throws(()=>buildPhase3BlockerReport(m),/Invalid, duplicate or evidence-free/);
});
