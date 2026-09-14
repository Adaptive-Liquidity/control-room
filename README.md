# Control Room

<div align="center">

**Governed operations for autonomous marketing systems.**

Control Room is Asentxia Systems' command layer for **DCA-Workware**: a persistent digital department where specialized workers can research, create, review, publish, measure, and improve work under explicit human authority.

[![CI](https://github.com/Adaptive-Liquidity/control-room/actions/workflows/ci.yml/badge.svg)](https://github.com/Adaptive-Liquidity/control-room/actions/workflows/ci.yml)
![Status](https://img.shields.io/badge/status-integration--stage-b7c76b)
![Next.js](https://img.shields.io/badge/Next.js-14-111111)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)

[Why Control Room](#why-control-room) · [Operating loop](#the-operating-loop) · [DCA responsibilities](#dca-workware) · [Architecture](#system-architecture) · [Run locally](#run-locally)

</div>

---

## Why Control Room

Generating content is easy. Operating a durable, accountable marketing function is not.

Most automation ends at the output. It does not preserve the context behind a decision, enforce who may authorize an action, bind approval to an exact revision, recover safely when an external workflow fails, or prove what was ultimately published.

Control Room provides the missing operating surface. It separates policy and accountability from execution, giving humans one place to direct work while autonomous processes operate inside bounded rules.

**The result is not another content generator. It is the foundation of a governed digital department.**

## What is DCA-Workware?

**Distributed Cognitive Architecture (DCA)** is Asentxia's model-neutral reference architecture for persistent autonomous intelligence. **DCA-Workware** applies those responsibilities to sustained organizational work.

In Control Room, that means:

- objectives persist beyond a single prompt or session;
- company and project context are versioned and composed into relevant generation operations;
- authority is scoped by role, project, policy, risk, and human approval;
- external execution is mediated through authenticated contracts;
- revisions, decisions, runs, metrics, and publication outcomes leave inspectable records;
- specialized workers coordinate without collapsing policy, execution, and evidence into one opaque agent.

Control Room currently implements a substantial policy, workflow, and evidence foundation. It does **not** yet claim complete implementation of all seven DCA responsibilities or full VERA-backed worker identity.

## Where Control Room sits

```mermaid
flowchart TD
    A[Asentxia Systems] --> D[DCA reference architecture]
    D --> C[Continuum implementation]
    C --> V[VERA principals]
    C --> R[The Regency governance]
    C --> W[DCA-Workware]
    W --> CR[Control Room]
    R -->|Governs| V
    V -->|Performs bounded work| W
```

- **Asentxia Systems** defines Distributed Cognitive Architecture.
- **DCA** defines the responsibilities required for persistent, accountable autonomous intelligence.
- **Continuum** is Asentxia's flagship implementation of DCA.
- **Continuum Computers** provide persistent logical environments independent of a particular session or host.
- **VERA** is the persistent accountable principal that performs work through scoped, revocable authority.
- **The Regency** governs VERAs and multi-VERA organizations.
- **DCA-Workware** applies this architecture to sustained organizational functions.
- **Control Room** is the human command, policy, coordination, and evidence surface for marketing Workware.

This is the target architectural placement. The present repository implements the Control Room application, policy/evidence foundation, and n8n bridge. Continuum, Continuum Computer, VERA, and Regency integration remains a separately evidenced integration stage.

## The operating loop

```mermaid
flowchart LR
    O[Objective] --> R[Research]
    R --> C[Creation]
    C --> G[Guardian]
    G --> H[Human approval]
    H --> P[Publishing]
    P --> M[Measurement]
    M --> X[Optimization]
    X --> O
```

Every stage advances through an explicit state transition. Generated work does not publish merely because a model produced it. By default, drafts enter human review; campaign policy may permit bounded low-risk automation. In every path, the work remains attached to an exact revision and requires a valid publication receipt before the system records it as published.

## The digital department

The target operating model assigns one clear responsibility to each worker. The table separates the intended department from what is implemented in this repository today.

| Role | Responsibility | Current repository state |
|---|---|---|
| **Director** | Sets priorities, turns objectives into campaigns and briefs, assigns work, coordinates the department, and tracks completion. | Human/operator responsibility supported by campaign controls, dashboard state, limits, pause, disable-generation, and emergency stop. A first-class autonomous Director is not implemented. |
| **Researcher** | Produces sourced market, audience, competitor, product, trend, and opportunity intelligence. | Seeded worker role with n8n-oriented execution and telemetry contracts. |
| **Creator** | Converts approved context and briefs into channel-native drafts, variants, headlines, calls to action, and creative requirements. | Seeded worker role; Studio supports generation, rewriting, asset attachment, saving, and submission. |
| **Guardian** | Evaluates brand, policy, regulatory, maturity, sourcing, and campaign constraints before approval. | Implemented policy service with `ALLOW`, `REVIEW`, and `BLOCK` outcomes, versioned policy results, flags, and fail-closed behavior when no active policy exists. |
| **Publisher** | Distributes the exact approved revision and returns a publication record. | Seeded worker and receipt-gated publishing contract. Included workflow export uses mock publishing until real channel credentials and cutover checks are complete. |
| **Analyzer** | Reconciles impressions, engagement, clicks, signups, conversions, attribution, cost, and economic outcomes. | Data model, authenticated ingestion, analytics, and attribution surfaces exist. Current metrics workflow is a stub until connected to approved platform data. |
| **Optimizer** | Converts evidence and experiment results into hypotheses, recommendations, and improved campaigns. | Experiment and A/B Lab foundations exist. A first-class autonomous Optimizer is not implemented. |

## Full department architecture

DCA-Workware is designed as a governed operating system for an entire function, not a collection of disconnected bots.

| Operating plane | Responsibilities | Control Room surface | Current maturity |
|---|---|---|---|
| **Command** | Objectives, priorities, briefs, budgets, assignments, deadlines, operating limits, and stop controls. | Dashboard, Campaigns, Calendar, Settings | Tested application foundation |
| **Market intelligence** | Market, audience, competitor, product, trend, community, and partnership research with sources and confidence. | Researcher telemetry, context packs, campaign intelligence inputs | Integration-stage |
| **Production** | Copy, channel-native content, campaign concepts, variants, calls to action, media briefs, and revision workflows. | Studio, Library, Content revisions | Tested application foundation; generation depends on n8n |
| **Assurance** | Brand, policy, regulatory, maturity, sourcing, risk, and campaign-rule evaluation. | Guardian pre-flight, approval queue, policy records | Tested implementation |
| **Authority** | Delegation, role scopes, approval requirements, revocation, risk ceilings, and emergency intervention. | RBAC, approval chain, campaign policy, emergency stop | Tested local authority foundation; Regency integration-stage |
| **Distribution** | Approved social, email, blog, community, partner, and paid-media execution. | Calendar, scheduling, Publisher telemetry, receipt ingestion | Integration-stage; included publisher is mocked until credentialed |
| **Measurement** | Impressions, engagement, clicks, signups, conversions, cost, attribution, revenue, and economic impact. | Analytics, Attribution, Agent runs | Data and ingestion foundation; live feeds integration-stage |
| **Optimization** | Experiments, hypotheses, variants, guardrails, outcomes, recommendations, and next-cycle decisions. | A/B Lab, campaign metrics | Tested experiment foundation; autonomous optimization is R&D |
| **Organizational governance** | Multi-worker structure, operating policy, budget review, evidence review, escalation, and weekly board decisions. | Team, Audit, Settings; future board surface | Active R&D |

### Extended operating domains

The full Workware direction extends the same governed loop across:

- brand and category intelligence;
- competitive monitoring and market change detection;
- organic social, community, email, editorial, and launch operations;
- campaign strategy, content production, design and media briefs;
- paid-media planning, budget control, and outcome measurement;
- partnership discovery, qualification, outreach, and deal workflow;
- reputation, maturity, compliance, and claim control;
- weekly evidence-based operating reviews covering spend, revenue impact, risk, performance, and next actions.

These domains describe the intended department architecture. They are not all delivered integrations in the current repository.

## What exists today

### Command

- **Dashboard** — approval queue, agent activity, upcoming work, and operating status.
- **Agent HQ** — worker configuration, connection state, execution history, latency, token use, cost, and failures.
- **Approval Queue** — approve, reject, request revision, edit before approval, and schedule approved work.
- **Studio** — create and rewrite drafts, apply project context, attach assets, run Guardian pre-flight, save, and submit.
- **Calendar** — inspect and manage scheduled work.

### Intelligence

- **Analytics** — stored performance observations and channel-level trends.
- **Attribution** — content and campaign events connected to downstream outcomes.
- **A/B Lab** — experiments, hypotheses, variants, primary metrics, guardrails, decisions, and measured lift when real results exist.

### Operations

- **Campaign control** — objectives, thesis, budgets, content and publishing limits, pause, generation disable, and emergency stop.
- **Context packs** — versioned company and project memory composed into execution context.
- **Asset library** — authenticated signed uploads and revision-level asset attachment.
- **Audit trail** — durable records of creation, revision, approval, rejection, publication, agent activity, integration events, and policy blocks.
- **Project-scoped teams** — membership, roles, invitations, active-project switching, and permission enforcement.
- **Integration health** — operational status without exposing credentials.

## Governance by construction

Human authority is part of the execution path, not a disclaimer placed after it.

- **Role-based authorization:** only permitted project members can create, edit, approve, configure, or administer work.
- **No false human approval:** `SERVICE` identities cannot perform or impersonate a human approval decision.
- **Revision-bound decisions:** approval references an immutable revision; later edits create a new revision and require a new decision.
- **Policy before approval:** Guardian evaluates every content-changing revision. A critical `BLOCK` cannot be bypassed through approve-with-edits.
- **Campaign controls:** pause, daily limits, automatic-generation disable, and emergency stop are enforced before generation and again at draft ingress.
- **Receipt-gated publication:** approval is not publication. Only a successful receipt matching the current revision and content hash can mark work as published.
- **Recoverable execution:** failed workflow callbacks remain in a retryable outbox instead of silently losing the decision.

These are implemented controls, not a security certification.

## DCA-Workware

Control Room maps organizational work onto the seven DCA responsibilities without claiming that the current repository completes the entire architecture.

| DCA responsibility | Control Room expression | Maturity |
|---|---|---|
| **Environment** | Next.js command surface, PostgreSQL state, project-scoped workspace, and a separate n8n execution plane. | Tested implementation |
| **State** | Versioned company/project context, campaigns, immutable content revisions, agent runs, metrics, attribution, and audit history. | Tested implementation |
| **Authority** | RBAC, human approval, Guardian policy, campaign limits, pause, disable-generation, and emergency stop. | Tested implementation |
| **Execution** | Authenticated n8n ingress, resumable approval workflow, encrypted callback state, and retryable outbox delivery. | Tested implementation / integration-stage |
| **Evidence** | Content hashes, revision-bound approvals, activity logs, agent-run telemetry, metric events, attribution events, and publication receipts. | Tested implementation; live evidence depends on connected integrations |
| **Coordination** | Explicit handoffs among research, creation, policy review, human approval, publishing, measurement, and experimentation. | Tested workflow foundation / integration-stage |
| **Cognition boundary** | Generation is separated from the policy plane through signed workflow contracts and composed context packs. | Integration-stage; provider neutrality is not yet demonstrated by this repository |

## System architecture

Control Room is the authoritative **policy and audit plane**. n8n is the external **execution plane**. Platform, channel, and model credentials remain in n8n rather than entering the application.

```mermaid
flowchart TD
    H[Human operators] --> C[Control Room]
    C -->|Policy and signed decisions| N[n8n execution]
    N --> P[Channels and data sources]
    P -->|Receipts, metrics, events| N
    N -->|Authenticated ingress| C
    C -->|Review and recovery| H
```

### Architectural planes

| Plane | Owns | Must not own |
|---|---|---|
| **Human command** | Objectives, budgets, policy, protected approvals, exceptions, escalation, and revocation. | Hidden execution or unrecorded decisions |
| **Control Room policy/audit** | Context, campaign policy, Guardian evaluation, revision state, authorization checks, recovery state, telemetry, and evidence. | External platform credentials or unconstrained model execution |
| **Cognition** | Research, reasoning, drafting, critique, synthesis, and recommendations through bounded interfaces. | Authority to silently widen its own capabilities |
| **n8n execution** | Workflow orchestration, model calls, channel actions, callbacks, and connector credentials. | Canonical approval history or the final truth of what Control Room authorized |
| **External systems** | Social networks, email, publishing, analytics, CRM, storage, paid media, and other connected services. | Internal policy authority |
| **Evidence** | Immutable revisions, decisions, hashes, receipts, telemetry, metrics, attribution, failures, and recovery history. | Unsupported inference presented as fact |

## Persistent operational memory

Workware must remember more than a transcript. Control Room separates several kinds of durable state:

| Memory class | What persists |
|---|---|
| **Institutional context** | Company voice, constraints, prohibited language, operating doctrine, and global policy. |
| **Project context** | Product facts, audience, goals, approved terminology, sources, and project-specific rules. |
| **Campaign state** | Objective, thesis, audience, schedule, budget, limits, risk policy, pause, and emergency status. |
| **Work state** | Content, immutable revisions, assets, status, approval history, schedule, and publication outcome. |
| **Worker state** | Role, configuration, connection status, run history, latency, token use, cost, and failures. |
| **Evidence state** | Guardian result, policy version, content hash, reviewer decision, audit event, receipt, and integration metadata. |
| **Learning state** | Metrics, attribution events, experiment hypotheses, variants, outcomes, and approved next-cycle decisions. |

Today these records persist in PostgreSQL through Prisma. The target Continuum architecture extends continuity across changing models, credentials, sessions, runtimes, computers, and hosts without changing the accountable principal.

## Authority architecture

In the complete architecture, authority flows from a human Regent through The Regency to one or more VERA principals. Authority is explicit, scoped, time-bound where appropriate, revocable, and attached to evidence.

```mermaid
flowchart TD
    R[Regent] -->|Defines policy and delegates| G[The Regency]
    G -->|Grants bounded authority| V[VERA worker]
    V -->|Proposes protected action| C[Control Room]
    C -->|Policy and Guardian evaluation| H[Human approval boundary]
    H -->|Authorized instruction| E[Execution plane]
    E -->|Receipt and outcome| C
    C -->|Evidence and escalation| R
```

The current implementation realizes part of this model through users, project memberships, RBAC, campaign policies, Guardian checks, human approvals, and stop controls. It does not yet implement complete Regency delegation or VERA authority continuity.

### Authority invariants

- A worker receives only the capabilities required for its assigned responsibility.
- Service identities cannot impersonate human approval.
- Protected actions remain reviewable and revocable.
- Changing approved work invalidates the previous decision path.
- Campaign policy is evaluated before expensive generation and again before draft ingestion.
- Critical Guardian blocks fail closed.
- External execution cannot mark itself successful without an accepted receipt.
- Emergency stop and revocation take precedence over scheduled or autonomous work.

## Operation lifecycle

```mermaid
stateDiagram-v2
    [*] --> Objective
    Objective --> Research
    Research --> Draft
    Draft --> Guardian
    Guardian --> Blocked: BLOCK
    Guardian --> Review: ALLOW or REVIEW
    Blocked --> Draft: Revise
    Review --> Draft: Request revision
    Review --> Approved: Authorize
    Approved --> Scheduled
    Scheduled --> Publishing
    Publishing --> Published: Valid receipt
    Publishing --> Recovery: Failure
    Recovery --> Publishing: Retry or intervention
    Published --> Measurement
    Measurement --> Experiment
    Experiment --> Objective: Adopt learning
```

Each transition preserves the operation's project, campaign, revision, authority, policy, and evidence context. A failed integration is a visible recoverable state. It is never silently rewritten as success.

### Execution contract

1. Control Room evaluates campaign policy and composes versioned company and project context.
2. n8n performs research or generation in the execution plane.
3. Draft ingress creates the content record, immutable revision, Guardian result, and encrypted resume job.
4. An authorized human approves, rejects, or requests revision.
5. The decision enters a durable outbox and resumes the waiting workflow through a separately signed callback.
6. Publishing occurs externally.
7. A signed receipt must match the current revision and content hash before publication is recorded.
8. Agent runs, metrics, attribution, and failures return as evidence.

## Evidence and trust boundaries

Control Room intentionally separates demonstrated behavior from incomplete integration.

### Tested in the repository

- project-scoped authentication and role-based authorization;
- immutable revision and approval relationships;
- Guardian evaluation, risk tiers, and policy blocking;
- HMAC verification, replay-window checks, and idempotent ingress;
- encrypted workflow resume URLs;
- retryable outbox state transitions;
- receipt-gated publication transitions;
- campaign policy and stop controls;
- analytics, attribution, experiment, agent-run, and audit data models;
- unit, API, component, and Playwright test suites;
- CI for lint, typecheck, tests, coverage, and production build.

### Integration-stage

- live n8n Wait/resume lifecycle in the target environment;
- production channel credentials and non-mock publishing;
- platform-native analytics and attribution feeds;
- production scheduling frequency for outbox recovery;
- live agent telemetry across every department role.

### Product direction / active R&D

- VERA-backed persistent worker identity and revocable authority;
- a first-class autonomous Director and Optimizer;
- governed competitive monitoring and partnership discovery;
- paid-media planning, allocation, and performance optimization;
- community operations and structured deal workflows;
- evidence-grounded weekly operating and board reviews covering spend, outcomes, risk, and next actions.

## Weekly board cycle

The full department closes each operating period with an evidence-grounded review:

1. **Assemble the record** — active objectives, completed work, spend, receipts, metrics, attribution, failures, unresolved risks, and experiment outcomes.
2. **Reconcile impact** — distinguish observed revenue or conversion impact from correlation and unsupported attribution.
3. **Review governance** — blocked work, policy warnings, exceptions, revocations, and authority changes.
4. **Assess performance** — channel, campaign, worker, workflow, latency, cost, and outcome quality.
5. **Decide** — continue, stop, revise, reallocate, investigate, or authorize a bounded experiment.
6. **Issue the next mandate** — convert approved decisions into new objectives, briefs, budgets, policies, and accountable owners.
7. **Seal the meeting record** — retain decisions, evidence, dissent, limitations, and follow-up actions for the next cycle.

This board cycle is an architectural target. Existing campaign, metric, attribution, experiment, approval, and audit records provide its data foundation; an automated board-meeting product surface is not yet implemented.

## VERA and human authority

**VERA** means **Verifiable Entity with Revocable Authority**: a persistent autonomous principal designed to retain identity and responsibility while models, credentials, sessions, runtimes, and hosts change.

Control Room is being prepared to govern VERA-backed workers through explicit scopes, approval requirements, revocation, and evidence. The current repository uses project-scoped user and agent identities; it should not yet be described as a complete VERA implementation.

Humans define the authority boundary. Autonomous workers may research, propose, generate, coordinate, and measure within policy. Explicit campaign policy may authorize bounded low-risk paths, but workers cannot silently expand their own permissions, impersonate a human decision, or convert approval into a publication claim without evidence.

## Technology

| Layer | Technology |
|---|---|
| Application | Next.js 14, React 18, TypeScript, Tailwind CSS, Radix UI |
| Identity and access | NextAuth, project-scoped RBAC |
| State | PostgreSQL, Prisma Migrate |
| Execution bridge | n8n, versioned Zod contracts, HMAC authentication |
| Recovery | Transactional outbox with bounded retry/backoff |
| Realtime | Pusher with polling fallback |
| Assets | Firebase Admin / Google Cloud Storage signed uploads |
| Measurement | Recharts, metric snapshots, attribution events, experiments |
| Verification | Jest, Testing Library, Playwright, GitHub Actions |

## Run locally

### Requirements

- Node.js 20+
- npm
- PostgreSQL 16
- n8n only when exercising external generation and execution workflows

### 1. Install

```bash
git clone https://github.com/Adaptive-Liquidity/control-room.git
cd control-room
npm ci
cp .env.example .env
```

Set the required local values in `.env`:

```dotenv
DATABASE_URL="postgresql://user:password@localhost:5432/control_room"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
N8N_INGRESS_SECRET="replace-with-a-long-random-secret"
N8N_RESUME_SECRET="replace-with-a-different-random-secret"
N8N_BRIDGE_ENCRYPTION_KEY="64-character-hex-key"
CRON_SECRET="replace-with-a-long-random-secret"
```

See [`.env.example`](./.env.example) for optional Studio, realtime, asset, and email integrations.

### 2. Initialize the database

```bash
npm run db:migrate
npm run db:seed-guardian
npm run db:seed-agents
npm run db:ensure-dev-users
```

`db:ensure-dev-users` is for local development and E2E only. Never run it in staging or production.

### 3. Start

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Local test identities are documented in [`AGENTS.md`](./AGENTS.md).

## Production initialization

Use migrations, create the first administrator from environment variables, then invite a separate `SERVICE` member for n8n attribution.

```bash
npm run db:migrate
npm run db:seed-guardian
npm run db:seed-agents

BOOTSTRAP_ADMIN_EMAIL="ops@example.com" \
BOOTSTRAP_ADMIN_PASSWORD="replace-with-a-strong-password" \
BOOTSTRAP_ADMIN_NAME="Operations Admin" \
npm run db:bootstrap-admin
```

Do not use `prisma db push`, local development users, or browser-exposed workflow resume URLs in production.

Before cutover, complete every item in the [24-gate production checklist](./docs/cutover-checklist.md).

## n8n integration

Importable workflow snapshots are available in [`n8n/workflows`](./n8n/workflows). The full bridge specification documents:

- shared HMAC headers and replay protection;
- campaign policy checks and composed context packs;
- draft ingress and idempotency;
- encrypted Wait/resume delivery;
- publication receipts;
- agent-run, metric, and attribution ingress;
- recovery and credential boundaries.

Read the [n8n bridge contract](./docs/n8n-bridge.md) before connecting an execution environment.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Authenticated E2E requires seeded local users and `E2E_WITH_AUTH=1`. The complete live lifecycle additionally requires a staging n8n Wait environment and `E2E_FULL_LIFECYCLE=1`.

The repository's GitHub Actions workflow runs lint, typecheck, tests, coverage, and a production build on pushes and pull requests to `main`.

## Repository map

```text
src/app/                    Next.js application and API routes
src/components/             Product and responsive interface components
src/lib/guardian/           Policy evaluation and risk logic
src/lib/n8n/                Signed bridge contracts and clients
src/lib/outbox/             Durable callback recovery
src/lib/scope/              Project isolation helpers
src/services/               Application services and state transitions
src/__tests__/              Unit, API, and component tests
e2e/                        Playwright journeys
prisma/                     Schema and reproducible migrations
n8n/workflows/              Importable execution workflow snapshots
docs/n8n-bridge.md          Integration contract
docs/cutover-checklist.md   Production acceptance gates
```

## Operating principles

1. **Humans retain authority.** Protected actions require explicit authorization.
2. **Approval belongs to a revision.** Change the work and the decision must be reconsidered.
3. **Publication requires evidence.** Intent is not treated as an external outcome.
4. **Failures remain visible.** Interrupted execution becomes recoverable state, not silent loss.
5. **Context is versioned.** Company and project memory can be inspected and reproduced.
6. **Credentials follow responsibility.** Platform and model secrets remain in the execution plane.
7. **Claims stop at the evidence boundary.** Planned autonomy is not presented as delivered autonomy.

## License and authorized use

No open-source license is currently included. Except for rights necessary to view and fork the repository through GitHub under its Terms of Service, no permission is granted to use, modify, distribute, sublicense, or commercialize the software.

For licensing, technical collaboration, or deployment discussions, contact [contact@asentxia.com](mailto:contact@asentxia.com).

---

<div align="center">

**Asentxia Systems** builds machine-native infrastructure for autonomous intelligence.

**systems beyond intelligence.**

[asentxia.com](https://asentxia.com)

</div>
