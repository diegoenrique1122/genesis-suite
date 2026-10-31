import assert from 'node:assert/strict';
import { loadCoachSettings, coachRegistrationLink } from '../src/services/coachSettingsService.js';

// A failed roster/referral query must never turn into a successful empty list.
function clientWith({ failTable = '', missingProfile = false } = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      const call = { table, filters: [] };
      calls.push(call);
      const query = {
        select() { return query; },
        eq(field, value) { call.filters.push([field, value]); return query; },
        order() { return query; },
        single() { return query; },
        maybeSingle() { return query; },
        then(resolve, reject) {
          let data = null;
          const error = table === failTable ? new Error('Connection unavailable') : null;
          if (table === 'coaches_profile') {
            data = call.filters.some(([field]) => field === 'referred_by_coach_id')
              ? [] : missingProfile ? null : { id: 'coach-one', user_id: 'user-one' };
          }
          if (table === 'athletes_profile') data = [];
          return Promise.resolve({ data, error }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

const unauthenticated = clientWith();
await assert.rejects(loadCoachSettings(unauthenticated, null));
assert.equal(unauthenticated.calls.length, 0);
await assert.rejects(loadCoachSettings(clientWith({ missingProfile: true }), 'user-one'));
for (const failTable of ['coaches_profile', 'super_admin_settings', 'user_preferences', 'athletes_profile']) {
  await assert.rejects(loadCoachSettings(clientWith({ failTable }), 'user-one'), /Connection unavailable/);
}
const client = clientWith();
const result = await loadCoachSettings(client, 'user-one');
assert.deepEqual(result.athletes, []);
assert.deepEqual(result.referredCoaches, []);
assert.deepEqual(client.calls.find((q) => q.table === 'athletes_profile').filters, [['coach_id', 'coach-one']]);
assert.ok(client.calls.filter((q) => q.table === 'user_preferences').every((q) => q.filters.some(([k,v]) => k === 'user_id' && v === 'user-one')));
assert.equal(coachRegistrationLink('https://beta.example'), 'https://beta.example/register/coach');
console.log('GENESIS_COACH_SETTINGS_CONTRACT_PASS');
