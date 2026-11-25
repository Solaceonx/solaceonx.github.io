const { test } = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../coc-stats.js');

const history = (count = 8, increment = 10) => Array.from({ length: count }, (_, i) => ({
  date: `2026-03-${String(5 + i).padStart(2, '0')}`, attacksWon: 100 + i * increment
}));

test('sums all accounts over seven complete days, including a DST change', () => {
  const stats = create([{ history: history() }, { history: history(8, 20) }]);
  assert.equal(stats.sevenDayDelta('attacksWon'), 210);
  assert.equal(stats.bestDailyRecord('attacksWon').value, 30);
  assert.equal(stats.bestSevenDayRecord('attacksWon').value, 210);
});

test('a long gap cannot become a daily or weekly record', () => {
  const rows = history();
  rows.push({ date: '2026-11-25', attacksWon: 1370 });
  const stats = create([{ history: rows }]);
  assert.equal(stats.sevenDayDelta('attacksWon'), null);
  assert.equal(stats.bestDailyRecord('attacksWon').value, 10);
  assert.equal(stats.bestSevenDayRecord('attacksWon').value, 70);
});

test('missing data from one account invalidates the combined week', () => {
  const partial = history();
  partial.splice(3, 1);
  const stats = create([{ history: history() }, { history: partial }]);
  assert.equal(stats.sevenDayDelta('attacksWon'), null);
  assert.equal(stats.bestSevenDayRecord('attacksWon').value, null);
  assert.equal(stats.bestDailyRecord('attacksWon').value, 20);
});

test('zero activity is different from missing data or a counter reset', () => {
  assert.equal(create([{ history: history(8, 0) }]).sevenDayDelta('attacksWon'), 0);
  const rows = history();
  rows[4].attacksWon = 0;
  assert.equal(create([{ history: rows }]).sevenDayDelta('attacksWon'), null);
  delete rows[4].attacksWon;
  assert.equal(create([{ history: rows }]).sevenDayDelta('attacksWon'), null);
  assert.equal(create([]).bestDailyRecord('attacksWon').value, null);
});

test('records resume only after seven complete daily intervals', () => {
  const rows = history();
  rows.push({ date: '2026-03-20', attacksWon: 1000 });
  for (let date = 21; date <= 26; date++) rows.push({ date: `2026-03-${date}`, attacksWon: 1000 + (date - 20) * 20 });
  assert.equal(create([{ history: rows }]).sevenDayDelta('attacksWon'), null);
  rows.push({ date: '2026-03-27', attacksWon: 1140 });
  assert.equal(create([{ history: rows }]).sevenDayDelta('attacksWon'), 140);
  assert.equal(create([{ history: rows }]).bestSevenDayRecord('attacksWon').value, 140);
});
