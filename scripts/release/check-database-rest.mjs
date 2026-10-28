import { checkDatabaseRest } from './rest-contract.mjs';
try { console.log(JSON.stringify(await checkDatabaseRest())); }
catch(error) {
  // Never forward server content, request headers or credential values.
  const safe=/^DB (?:contract mismatch: (?:migrations|game|tables|functions|readonly_routines|event_triggers)|inspector source\/security contract mismatch|response identity, read-only mode or freshness mismatch)$|^PostgREST hall RPC route\/signature unavailable: [a-z0-9_]+ HTTP [0-9]{3}$|^Unexpected PostgREST missing-route response$|^Public API HTTP [0-9]{3}$/;
  const reason=safe.test(error.message)?error.message:'authentication, network, timeout or response validation failed';
  console.error(`Production read-only GET gate failed: ${reason}. No deploy.`);process.exitCode=1;
}
