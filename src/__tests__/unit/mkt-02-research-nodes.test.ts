import { readFileSync } from 'fs';
import { join } from 'path';

type WorkflowNode = {
  id?: string;
  name: string;
  type: string;
  parameters?: {
    jsCode?: string;
    content?: string;
    url?: string;
    authentication?: string;
    genericAuthType?: string;
    responses?: { values?: Array<{ content?: string; role?: string }> };
  };
  credentials?: Record<string, { id?: string; name?: string }>;
};

type WorkflowFile = {
  id: string;
  nodes: WorkflowNode[];
  connections: Record<string, { main?: Array<Array<{ node: string }>> }>;
};

function loadWorkflow(file: string): WorkflowFile {
  return JSON.parse(readFileSync(join(process.cwd(), file), 'utf8')) as WorkflowFile;
}

function nodeJs(wf: WorkflowFile, name: string): string {
  return wf.nodes.find((n) => n.name === name)?.parameters?.jsCode ?? '';
}

function runCode(
  js: string,
  item: unknown,
  lookup: Record<string, unknown> = {}
) {
  const fn = new Function('$input', '$', js);
  return fn(
    { first: () => ({ json: item }) },
    (name: string) => {
      if (!(name in lookup)) throw new Error('unknown node ' + name);
      return { item: { json: lookup[name] } };
    }
  ) as Array<{ json: Record<string, unknown> }>;
}

describe('MKT-02 researcher workflow export', () => {
  const wf = loadWorkflow('n8n/workflows/mkt-03-04-05.json');
  const studio = loadWorkflow('n8n/workflows/studio-generate.json');

  it('edits the existing staged workflow only', () => {
    expect(wf.id).toBe('Mr2NsTTTVKvuGZKa');
    expect(studio.id).toBe('58oYBY2ODlpRYhcc');
    const names = wf.nodes.map((n) => n.name);
    expect(names).toContain('MKT-04 ⏸ Wait for Human Approval (24h max)');
    expect(names).toContain('MKT-03 ▪ Creator LLM (OpenAI)');
    expect(names).toContain('MKT-03 ▪ Control Room Draft Handoff');
    expect(names.filter((n) => /notion|gmail|sheets|firecrawl|serpapi/i.test(n))).toEqual([]);
  });

  it('wires Assert → Build → Exa → Prepare → LLM → Parse → Creator', () => {
    const next = (from: string) => wf.connections[from]?.main?.[0]?.[0]?.node;
    expect(next('MKT-03 ▪ Assert Policy Allowed')).toBe('MKT-02 ▪ Build research task');
    expect(next('MKT-02 ▪ Build research task')).toBe('MKT-02 ▪ Exa search');
    expect(next('MKT-02 ▪ Exa search')).toBe('MKT-02 ▪ Prepare researcher messages');
    expect(next('MKT-02 ▪ Prepare researcher messages')).toBe(
      'MKT-02 ▪ Researcher LLM (OpenAI)'
    );
    expect(next('MKT-02 ▪ Researcher LLM (OpenAI)')).toBe('MKT-02 ▪ Parse Research JSON');
    expect(next('MKT-02 ▪ Parse Research JSON')).toBe('MKT-03 ▪ Creator LLM (OpenAI)');
  });

  it('keeps Creator on researchBrief string and does not invent citations in the prompt', () => {
    const creator = wf.nodes.find((n) => n.name === 'MKT-03 ▪ Creator LLM (OpenAI)');
    const creatorPrompt = creator?.parameters?.responses?.values?.[0]?.content ?? '';
    expect(creatorPrompt).toContain('$json.researchBrief');

    const llm = wf.nodes.find((n) => n.name === 'MKT-02 ▪ Researcher LLM (OpenAI)');
    const roles = (llm?.parameters?.responses?.values ?? []).map((v) => v.role);
    expect(roles).toEqual(['system', 'user']);
    expect(JSON.stringify(llm?.parameters?.responses)).toContain('$json.system');
    expect(JSON.stringify(llm?.parameters?.responses)).toContain('$json.user');
    expect(JSON.stringify(llm)).not.toMatch(/hypothetical/i);

    const parseJs = nodeJs(wf, 'MKT-02 ▪ Parse Research JSON');
    expect(parseJs).toContain("throw new Error('Researcher returned non-JSON')");
    expect(parseJs).not.toContain('angles: [], risks: [], sources: []');
    expect(parseJs).toContain("researchBrief: JSON.stringify(research)");
    expect(parseJs).toContain("promptVersionResearch: 'mkt-02-v2'");
  });

  it('configures Exa search without embedding a secret', () => {
    const exa = wf.nodes.find((n) => n.name === 'MKT-02 ▪ Exa search');
    expect(exa?.parameters?.url).toBe('https://api.exa.ai/search');
    expect(exa?.parameters?.authentication).toBe('genericCredentialType');
    expect(exa?.parameters?.genericAuthType).toBe('httpHeaderAuth');
    expect(exa?.credentials?.httpHeaderAuth?.name).toBe('Exa API');
    expect(JSON.stringify(exa)).not.toMatch(/exa_[A-Za-z0-9]/);
    expect(JSON.stringify(exa)).not.toContain('x-api-key":');

    const note = wf.nodes.find((n) => n.name === 'Sticky Note MKT-02 Researcher');
    const noteText = note?.parameters?.content ?? '';
    expect(noteText).toContain('x-api-key');
    expect(noteText).toContain('Mr2NsTTTVKvuGZKa');
    expect(noteText).toContain('Do **not** POST `/drafts`');
  });
});

describe('MKT-02 ▪ Build research task', () => {
  const js = nodeJs(loadWorkflow('n8n/workflows/mkt-03-04-05.json'), 'MKT-02 ▪ Build research task');

  it('builds Exa query from contextPack identity', () => {
    const [out] = runCode(
      js,
      {
        policyAllowed: true,
        policy: {
          allowed: true,
          contextPack: {
            promptCore: {
              identity: {
                name: 'AEON',
                legalName: 'Adaptive Liquidity Labs',
                oneLiner: 'Treasury automation',
              },
            },
          },
        },
      },
      { 'Config Base URL': { projectId: 'proj_aeon' } }
    );
    expect(out.json.question).toContain('AEON');
    expect(out.json.query).toContain('Adaptive Liquidity Labs');
    expect(out.json.query).toContain('competitors');
    expect(out.json.query).toContain('Treasury automation');
    expect((out.json.exaBody as { query: string }).query).toBe(out.json.query);
    expect(out.json.system).toContain('AEON');
    expect(out.json.projectId).toBe('proj_aeon');
  });

  it('falls back when pack is missing', () => {
    const [out] = runCode(
      js,
      { policyAllowed: true, policy: { allowed: true } },
      { 'Config Base URL': { projectId: 'proj_aeon' } }
    );
    expect(String(out.json.system)).toContain('Do not invent sources');
    expect(String(out.json.query)).toContain('Adaptive Liquidity');
  });
});

describe('MKT-02 ▪ Prepare researcher messages', () => {
  const js = nodeJs(
    loadWorkflow('n8n/workflows/mkt-03-04-05.json'),
    'MKT-02 ▪ Prepare researcher messages'
  );

  it('passes only Exa hits as allowed locators', () => {
    const [out] = runCode(
      js,
      {
        results: [
          {
            id: 'exa-hit-1',
            url: 'https://example.com/a',
            title: 'Treasury desk',
            text: 'Observable ops tooling.',
          },
        ],
      },
      {
        'MKT-02 ▪ Build research task': {
          question: 'Which products?',
          system: '{"promptCore":{}}',
        },
      }
    );
    expect(out.json.searchHitCount).toBe(1);
    expect(out.json.allowedSourceLocators).toEqual([
      'exa-hit-1',
      'https://example.com/a',
    ]);
    expect(String(out.json.user)).toContain('https://example.com/a');
    expect(String(out.json.user)).toContain('Never fabricate citations');
    expect(String(out.json.user)).not.toMatch(/hypothetical/i);
  });
});

describe('MKT-02 ▪ Parse Research JSON', () => {
  const js = nodeJs(loadWorkflow('n8n/workflows/mkt-03-04-05.json'), 'MKT-02 ▪ Parse Research JSON');
  const preparedWithHit = {
    allowedSourceLocators: ['https://example.com/a', 'exa-1'],
    searchHitCount: 1,
  };

  it('throws on non-JSON instead of manufacturing a brief', () => {
    expect(() =>
      runCode(js, { output: 'not json at all' }, { 'MKT-02 ▪ Prepare researcher messages': preparedWithHit })
    ).toThrow('Researcher returned non-JSON');
  });

  it('throws when question or summary is missing', () => {
    expect(() =>
      runCode(
        js,
        { output: JSON.stringify({ summary: 'Only summary' }) },
        { 'MKT-02 ▪ Prepare researcher messages': preparedWithHit }
      )
    ).toThrow('expected question + summary');
  });

  it('keeps Exa sources and drops invented citations', () => {
    const [out] = runCode(
      js,
      {
        output: JSON.stringify({
          question: 'Which products?',
          summary: 'Treasury ops tooling is the live narrative.',
          angles: ['Ops, not yield'],
          risks: ['No guaranteed APY'],
          sources: [
            { id: 'exa-1', url: 'https://example.com/a', title: 'Treasury desk' },
            { id: 'fake', url: 'https://invented.example/nope', title: 'Made up' },
          ],
          evidence: [
            { finding: 'Public ops tooling exists', sourceIds: ['exa-1', 'fake'], confidence: 'MEDIUM' },
          ],
          openQuestions: [],
        }),
      },
      { 'MKT-02 ▪ Prepare researcher messages': preparedWithHit }
    );
    const research = out.json.research as {
      sources: string[];
      evidence: Array<{ sourceIds: string[] }>;
    };
    expect(research.sources).toEqual(['Treasury desk — https://example.com/a']);
    expect(research.evidence[0].sourceIds).toEqual(['exa-1']);
    expect(typeof out.json.researchBrief).toBe('string');
    expect(JSON.parse(out.json.researchBrief as string).summary).toContain('Treasury ops');
    expect(out.json.promptVersionResearch).toBe('mkt-02-v2');
  });

  it('requires openQuestions when Exa returned no hits', () => {
    expect(() =>
      runCode(
        js,
        {
          output: JSON.stringify({
            question: 'Which products?',
            summary: 'No public hits this run.',
            sources: [{ url: 'https://invented.example' }],
            openQuestions: [],
          }),
        },
        { 'MKT-02 ▪ Prepare researcher messages': { allowedSourceLocators: [], searchHitCount: 0 } }
      )
    ).toThrow('no search hits and no openQuestions');

    const [out] = runCode(
      js,
      {
        output: JSON.stringify({
          question: 'Which products?',
          summary: 'No public hits this run.',
          sources: [{ url: 'https://invented.example' }],
          evidence: [{ finding: 'Invented', sourceIds: ['x'] }],
          openQuestions: ['Need a real competitor scan next week.'],
        }),
      },
      { 'MKT-02 ▪ Prepare researcher messages': { allowedSourceLocators: [], searchHitCount: 0 } }
    );
    const research = out.json.research as { sources: string[]; evidence: unknown[] };
    expect(research.sources).toEqual([]);
    expect(research.evidence).toEqual([]);
  });

  it('parses simplified OpenAI Responses output arrays', () => {
    const payload = {
      question: 'Which products?',
      summary: 'From responses array.',
      sources: [{ id: 'exa-1', url: 'https://example.com/a', title: 'Hit' }],
    };
    const [out] = runCode(
      js,
      {
        output: [
          {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', output_text: JSON.stringify(payload) }],
          },
        ],
      },
      { 'MKT-02 ▪ Prepare researcher messages': preparedWithHit }
    );
    expect((out.json.research as { summary: string }).summary).toBe('From responses array.');
  });
});
