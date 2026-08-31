'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type ProjectRow = {
  id: string;
  slug: string;
  name: string;
  companyId: string;
  companyName: string;
  companySlug: string;
};

export function ProjectSwitcher() {
  const queryClient = useQueryClient();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => {
        setProjects(data.projects ?? []);
        setActiveId(data.activeProjectId ?? null);
      })
      .catch(() => undefined);
  }, []);

  const active = projects.find((p) => p.id === activeId) ?? projects[0];
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; items: ProjectRow[] }>();
    for (const p of projects) {
      const g = map.get(p.companyId) ?? { name: p.companyName, items: [] };
      g.items.push(p);
      map.set(p.companyId, g);
    }
    return Array.from(map.entries());
  }, [projects]);

  async function selectProject(projectId: string) {
    const res = await fetch('/api/projects/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    });
    if (!res.ok) return;
    queryClient.clear();
    window.location.reload();
  }

  if (!projects.length) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label="Switch project"
          className="h-8 max-w-[220px] gap-1 truncate text-xs"
        >
          <span className="truncate">{active?.name ?? 'Select project'}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {grouped.map(([companyId, group]) => (
          <div key={companyId}>
            <div className="px-2 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {group.name}
            </div>
            {group.items.map((p: ProjectRow) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => selectProject(p.id)}
                className={p.id === active?.id ? 'font-medium' : undefined}
              >
                {p.id === active?.id ? '✓ ' : ''}
                {p.name}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
