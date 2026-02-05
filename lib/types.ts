export type PlatformSource = 'instagram' | 'gmaps' | 'linkedin';
export type SearchMode = 'fast' | 'deep';
export type PageView = 'login' | 'dashboard' | 'campaigns';

export interface ProjectConfig {
  clientId: string;
  clientName: string;
  primaryColor: string; // Tailor UI color if needed, or just keep it simple
  targets: {
    icp: string; // Ideal Customer Profile description
    locations: string[];
  };
  enabledPlatforms: PlatformSource[];
  searchSettings: {
    defaultDepth: number;
    defaultMode: SearchMode;
  };
}

export interface Lead {
  id: string;
  source: PlatformSource;
  companyName: string;
  website?: string;
  socialUrl?: string;
  location?: string;
  decisionMaker?: {
    name: string;
    role: string; // e.g., "Founder", "Owner"
    email: string;
    phone?: string;
    linkedin?: string;
    facebook?: string;
    instagram?: string;
  };
  aiAnalysis: {
    summary: string; // "Venden suplementos veganos..."
    painPoints: string[];
    generatedIcebreaker: string; // The hook for the email
    fullMessage: string; // The complete outreach email
  };
  status: 'scraped' | 'enriched' | 'ready' | 'contacted' | 'replied';
}

export interface SearchConfigState {
  query: string;
  source: PlatformSource;
  mode: SearchMode;
  maxResults: number;
}

export interface SearchSession {
  id: string;
  date: Date;
  query: string;
  source: PlatformSource;
  resultsCount: number;
  leads: Lead[];
}
