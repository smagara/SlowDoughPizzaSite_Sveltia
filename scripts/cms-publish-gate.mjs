/**
 * Content-editor publishing gate — the GitHub side of Sveltia's Editorial Workflow.
 *
 * Sveltia maps its lanes to pull-request labels (sveltia-cms/draft → pending_review →
 * pending_publish) but GitHub itself only knows "draft" vs "ready for review", so an entry that
 * is merely *In Review* in the editor already looks mergeable on GitHub. This gate aligns the two:
 *
 *   • It reports a commit status `sveltia/workflow` on the PR's head commit:
 *       pending  – Draft / In Review / deletion request (merge button greyed out when the status
 *                  is required in the branch rule)
 *       failure  – Ready, but the PR check failed, or the four-eyes rule is not met
 *       success  – Ready (label sveltia-cms/pending_publish) and the PR check passed
 *     Dev PRs without a sveltia-cms/* label get `success` immediately so the required status
 *     never blocks normal code changes.
 *   • When an entry is Ready and the PR check passed it squash-merges the PR and dispatches the
 *     deploy workflow (pushes made with GITHUB_TOKEN do not trigger workflows, but
 *     workflow_dispatch is allowed). Staff therefore never need to open GitHub.
 *
 * Optional four-eyes rule (repository variable CMS_REQUIRE_SECOND_REVIEWER=true): the Ready
 * label must have been applied by someone other than the PR author; the PR timeline records who.
 *
 * `decide()` is pure and unit-tested (tests/unit/cms-publish-gate.test.mjs); `run()` wires it to
 * the GitHub API inside .github/workflows/cms-publish.yml.
 */

export const LABELS = {
  draft: 'sveltia-cms/draft',
  review: 'sveltia-cms/pending_review',
  ready: 'sveltia-cms/pending_publish',
  deletion: 'sveltia-cms/pending_deletion',
};

export const STATUS_CONTEXT = 'sveltia/workflow';
export const PR_CHECK_NAME = 'Validate & build (PR)';

/**
 * @param {object} input
 * @param {{ draft: boolean, labels: string[], author: string }} input.pr
 * @param {{ status: string, conclusion: string | null } | undefined} input.prCheck  The "Validate & build (PR)" check run for the head commit
 * @param {string | undefined} input.readyLabelActor  Login of whoever last added the Ready label
 * @param {{ requireSecondReviewer?: boolean }} [input.options]
 * @returns {{ state: 'pending' | 'success' | 'failure', description: string, merge: boolean, lane: string }}
 */
export function decide({ pr, prCheck, readyLabelActor, options = {} }) {
  const labels = pr.labels ?? [];
  const has = (l) => labels.includes(l);
  const isCms = labels.some((l) => l.startsWith('sveltia-cms/'));

  if (!isCms) return { lane: 'none', state: 'success', description: 'Not a content-editor pull request', merge: false };
  if (pr.draft || has(LABELS.draft)) return { lane: 'draft', state: 'pending', description: 'Draft in the content editor — not ready to publish', merge: false };
  if (has(LABELS.review)) return { lane: 'review', state: 'pending', description: 'In review in the content editor — move it to “Ready” to publish', merge: false };
  if (has(LABELS.deletion)) return { lane: 'deletion', state: 'pending', description: 'Deletion request — a developer merges this on GitHub', merge: false };
  if (!has(LABELS.ready)) return { lane: 'unknown', state: 'pending', description: 'Unknown content-editor state', merge: false };

  if (options.requireSecondReviewer) {
    if (!readyLabelActor || readyLabelActor === pr.author) {
      return { lane: 'ready', state: 'failure', description: `“Ready” must be set by someone other than the author (${pr.author})`, merge: false };
    }
  }
  if (!prCheck || prCheck.status !== 'completed') return { lane: 'ready', state: 'pending', description: 'Ready — waiting for the PR check to finish', merge: false };
  if (prCheck.conclusion !== 'success') return { lane: 'ready', state: 'failure', description: `Ready, but the PR check ${prCheck.conclusion ?? 'did not pass'} — see its log`, merge: false };

  return { lane: 'ready', state: 'success', description: readyLabelActor ? `Approved in the content editor by ${readyLabelActor} — publishing` : 'Approved in the content editor — publishing', merge: true };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Entry point used by the workflow (actions/github-script).
 * @param {{ github: any, context: any, core: any, requireSecondReviewer: boolean, deployWorkflow?: string }} args
 */
export async function run({ github, context, core, requireSecondReviewer, deployWorkflow = 'deploy.yml' }) {
  const repo = { owner: context.repo.owner, repo: context.repo.repo };

  let numbers = [];
  if (context.eventName === 'pull_request') numbers = [context.payload.pull_request.number];
  else if (context.eventName === 'workflow_run') numbers = (context.payload.workflow_run.pull_requests ?? []).map((p) => p.number);
  if (!numbers.length) {
    core.info('No pull request to evaluate.');
    return;
  }

  for (const number of numbers) {
    const { data: prData } = await github.rest.pulls.get({ ...repo, pull_number: number });
    if (prData.state !== 'open') {
      core.info(`#${number} is ${prData.state}; skipping.`);
      continue;
    }
    const sha = prData.head.sha;
    const labels = prData.labels.map((l) => l.name);
    const pr = { draft: prData.draft, labels, author: prData.user?.login ?? '' };

    let readyLabelActor;
    if (labels.includes(LABELS.ready)) {
      const events = await github.paginate(github.rest.issues.listEvents, { ...repo, issue_number: number, per_page: 100 });
      readyLabelActor = events.filter((e) => e.event === 'labeled' && e.label?.name === LABELS.ready).at(-1)?.actor?.login;
    }

    const { data: checks } = await github.rest.checks.listForRef({ ...repo, ref: sha, per_page: 100 });
    const prCheck = checks.check_runs.find((c) => c.name === PR_CHECK_NAME);

    const decision = decide({ pr, prCheck, readyLabelActor, options: { requireSecondReviewer } });
    core.info(`#${number} [${decision.lane}] → ${decision.state}: ${decision.description}`);
    await github.rest.repos.createCommitStatus({ ...repo, sha, state: decision.state, context: STATUS_CONTEXT, description: decision.description.slice(0, 140), target_url: prData.html_url });

    if (!decision.merge) continue;

    // Merge (retry briefly: the status we just set must be visible to branch protection first)
    let merged = false;
    let lastError;
    for (let attempt = 1; attempt <= 4 && !merged; attempt++) {
      try {
        await github.rest.pulls.merge({ ...repo, pull_number: number, merge_method: 'squash', commit_title: `${prData.title} (#${number})` });
        merged = true;
      } catch (error) {
        lastError = error;
        core.info(`Merge attempt ${attempt} failed: ${error.message}`);
        await sleep(5000 * attempt);
      }
    }
    if (!merged) {
      await github.rest.repos.createCommitStatus({ ...repo, sha, state: 'failure', context: STATUS_CONTEXT, description: `Could not merge automatically: ${lastError?.message ?? 'unknown error'}`.slice(0, 140), target_url: prData.html_url });
      core.warning(`#${number}: automatic merge failed — ${lastError?.message}`);
      continue;
    }

    // Deploy: a merge performed with GITHUB_TOKEN does not trigger push workflows, so dispatch it.
    await github.rest.actions.createWorkflowDispatch({ ...repo, workflow_id: deployWorkflow, ref: prData.base.ref });
    await github.rest.issues.createComment({
      ...repo,
      issue_number: number,
      body: `✅ Published automatically: the entry was moved to **Ready** in the content editor${readyLabelActor ? ` by @${readyLabelActor}` : ''} and the PR check passed. The site deployment has been started.`,
    });
    core.info(`#${number} merged and deployment dispatched.`);
  }
}
