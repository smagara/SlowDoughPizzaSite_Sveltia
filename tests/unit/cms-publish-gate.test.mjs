import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, LABELS } from '../../scripts/cms-publish-gate.mjs';

const ok = { status: 'completed', conclusion: 'success' };
const failed = { status: 'completed', conclusion: 'failure' };
const running = { status: 'in_progress', conclusion: null };
const pr = (labels, extra = {}) => ({ draft: false, labels, author: 'manager', ...extra });

test('dev PRs without a sveltia-cms label pass immediately and are never merged by the gate', () => {
  const d = decide({ pr: pr(['bug']), prCheck: ok });
  assert.equal(d.state, 'success'); assert.equal(d.merge, false); assert.equal(d.lane, 'none');
});

test('Draft and In Review are pending (merge blocked), even when the PR check passed', () => {
  assert.equal(decide({ pr: pr([LABELS.draft], { draft: true }), prCheck: ok }).state, 'pending');
  const review = decide({ pr: pr([LABELS.review]), prCheck: ok });
  assert.equal(review.state, 'pending'); assert.equal(review.merge, false); assert.match(review.description, /In review/);
});

test('a GitHub draft PR is pending regardless of labels', () => {
  assert.equal(decide({ pr: pr([LABELS.ready], { draft: true }), prCheck: ok }).state, 'pending');
});

test('Ready + PR check passed → success and merge', () => {
  const d = decide({ pr: pr([LABELS.ready]), prCheck: ok, readyLabelActor: 'owner' });
  assert.equal(d.state, 'success'); assert.equal(d.merge, true); assert.match(d.description, /owner/);
});

test('Ready but PR check still running → pending, not merged; failed check → failure', () => {
  assert.deepEqual([decide({ pr: pr([LABELS.ready]), prCheck: running }).state, decide({ pr: pr([LABELS.ready]), prCheck: running }).merge], ['pending', false]);
  assert.equal(decide({ pr: pr([LABELS.ready]), prCheck: failed }).state, 'failure');
  assert.equal(decide({ pr: pr([LABELS.ready]), prCheck: undefined }).state, 'pending');
});

test('four-eyes rule: Ready set by the author is rejected; by someone else accepted', () => {
  const opts = { requireSecondReviewer: true };
  assert.equal(decide({ pr: pr([LABELS.ready]), prCheck: ok, readyLabelActor: 'manager', options: opts }).state, 'failure');
  assert.equal(decide({ pr: pr([LABELS.ready]), prCheck: ok, readyLabelActor: undefined, options: opts }).state, 'failure');
  assert.equal(decide({ pr: pr([LABELS.ready]), prCheck: ok, readyLabelActor: 'owner', options: opts }).merge, true);
});

test('deletion requests are never auto-merged', () => {
  const d = decide({ pr: pr([LABELS.deletion]), prCheck: ok });
  assert.equal(d.state, 'pending'); assert.equal(d.merge, false);
});
