'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export default function SetupPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [companyName, setCompanyName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [oneLiner, setOneLiner] = useState('');
  const [voiceTone, setVoiceTone] = useState('precise, humble, architectural');
  const [dontSay, setDontSay] = useState('guaranteed yield, to the moon');
  const [projectName, setProjectName] = useState('');
  const [projectSlug, setProjectSlug] = useState('');
  const [projectOneLiner, setProjectOneLiner] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasCompany, setHasCompany] = useState(false);

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => {
        if (data.projects?.length) {
          setHasCompany(true);
        }
      })
      .catch(() => undefined);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: {
            name: companyName || 'My Company',
            legalName: legalName || undefined,
            slug: companySlug || slugify(companyName || 'my-company'),
            oneLiner: oneLiner || undefined,
            voiceTone,
            dontSay: dontSay
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          },
          project: {
            name: projectName || 'Main project',
            slug: projectSlug || slugify(projectName || 'main'),
            oneLiner: projectOneLiner || undefined,
            description: description || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Setup failed');
        return;
      }
      await update();
      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError('Setup failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Set up your HQ</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {hasCompany
          ? 'Add a project under your company. Brand voice stays on the company.'
          : 'Company brand first, then the product/project you will create content for.'}
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {!hasCompany && (
          <>
            <Input
              placeholder="Company name"
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                if (!companySlug) setCompanySlug(slugify(e.target.value));
              }}
              required
            />
            <Input
              placeholder="Legal name (optional)"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
            />
            <Input
              placeholder="Company slug"
              value={companySlug}
              onChange={(e) => setCompanySlug(slugify(e.target.value))}
              required
            />
            <Input
              placeholder="Company one-liner"
              value={oneLiner}
              onChange={(e) => setOneLiner(e.target.value)}
            />
            <Input
              placeholder="Voice tone"
              value={voiceTone}
              onChange={(e) => setVoiceTone(e.target.value)}
            />
            <Input
              placeholder="Don't-say terms (comma-separated)"
              value={dontSay}
              onChange={(e) => setDontSay(e.target.value)}
            />
          </>
        )}
        <Input
          placeholder="Project name"
          value={projectName}
          onChange={(e) => {
            setProjectName(e.target.value);
            if (!projectSlug) setProjectSlug(slugify(e.target.value));
          }}
          required
        />
        <Input
          placeholder="Project slug"
          value={projectSlug}
          onChange={(e) => setProjectSlug(slugify(e.target.value))}
          required
        />
        <Input
          placeholder="Project one-liner"
          value={projectOneLiner}
          onChange={(e) => setProjectOneLiner(e.target.value)}
        />
        <Textarea
          placeholder="Short project description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy || !session?.user}>
          {busy ? 'Saving…' : 'Enter HQ'}
        </Button>
      </form>
    </div>
  );
}
