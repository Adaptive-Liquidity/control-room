// src/types/index.ts

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: 'ADMIN' | 'MANAGER' | 'EDITOR' | 'VIEWER';
  permissions: string[];
  isActive: boolean;
}

export interface Content {
  id: string;
  title: string;
  body: string;
  type: ContentType;
  status: ContentStatus;
  channel: Channel;
  guardianScore: number;
  guardianChecks: GuardianChecks;
  guardianFlags: GuardianFlag[];
  predictedEngagement?: number;
  predictedReach?: number;
  predictedSignups?: number;
  impressions: number;
  engagements: number;
  signups: number;
  integrations: number;
  treasuryImpact: number;
  scheduledAt?: Date;
  publishedAt?: Date;
  version: number;
  authorId: string;
  author: User;
  campaignId?: string;
  campaign?: Campaign;
  approvals: Approval[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GuardianChecks {
  forbiddenWords: boolean;
  maturityBand: boolean;
  sources: boolean;
  disclaimer: boolean;
  yieldPromise: boolean;
  brandVoice: boolean;
}

export interface GuardianFlag {
  rule: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
  position?: { start: number; end: number };
}

export interface Approval {
  id: string;
  contentId: string;
  reviewerId: string;
  reviewer: User;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION';
  comment?: string;
  createdAt: Date;
}

export interface Campaign {
  id: string;
  name: string;
  theme: string;
  audience: string;
  status: string;
  startDate: Date;
  endDate?: Date;
  budget?: number;
  totalImpressions: number;
  totalEngagements: number;
  totalSignups: number;
  totalIntegrations: number;
  contents: Content[];
  creatorId: string;
  creator: User;
}

export interface Agent {
  id: string;
  name: string;
  type: 'CREATOR' | 'PUBLISHER' | 'ANALYZER' | 'GUARDIAN';
  status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'ERROR';
  config: Record<string, unknown>;
  metrics?: AgentMetrics;
  lastRunAt?: Date;
  mcpEndpoint?: string;
  mcpStatus: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
}

export interface AgentMetrics {
  tasksCompleted: number;
  successRate: number;
  avgLatency: number;
  errorsToday: number;
}

export interface AgentLog {
  timestamp: Date;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  agentId: string;
}

export interface ContentCalendarEvent {
  id: string;
  title: string;
  date: Date;
  channel: Channel;
  status: ContentStatus;
  contentId?: string;
}

export interface AttributionFunnel {
  stage: string;
  count: number;
  conversionRate: number;
  topDriver?: string;
}

export interface AnalyticsChannel {
  channel: Channel;
  pieces: number;
  impressions: number;
  engagementRate: number;
  signups: number;
  topPerformer: string;
}

export interface DashboardStats {
  pendingApprovals: number;
  scheduledPosts: number;
  publishedThisEpoch: number;
  activeAgents: number;
  guardianPassRate: number;
  contentToDevAttribution: number;
}

export type ContentType = 
  | 'TWITTER_THREAD' 
  | 'BLOG_POST' 
  | 'EMAIL' 
  | 'PRESS_RELEASE' 
  | 'AD_CREATIVE' 
  | 'VIDEO_SCRIPT' 
  | 'LINKEDIN_POST' 
  | 'DISCORD_MESSAGE';

export type ContentStatus = 
  | 'DRAFT' 
  | 'PENDING_REVIEW' 
  | 'APPROVED' 
  | 'REJECTED' 
  | 'SCHEDULED' 
  | 'PUBLISHED' 
  | 'ARCHIVED';

export type Channel = 'TWITTER' | 'LINKEDIN' | 'DISCORD' | 'EMAIL' | 'BLOG';
