export type ContactStatus = "New" | "Opened" | "Contacted" | "Replied" | "Follow Up" | "Closed" | "Not Interested" | "Interested" | "Invalid";
export type OfferType = 'Website' | 'Flyer' | 'Facebook Ads' | 'Other';

export interface Goal {
  id: string;
  type: 'flyer' | 'website' | 'ads' | 'leads';
  target: number;
  completed: number;
  date: string; // YYYY-MM-DD
  ownerId: string;
}

export interface Contact {
  id: string;
  businessName: string;
  contactName?: string;
  phoneNumber: string;
  niche?: string;
  offer?: OfferType;
  context?: string;
  notes?: string;
  status: ContactStatus;
  draftedMessage?: string;
  followUpDate?: string;
  lastContactedAt?: string;
  createdAt: string;
  ownerId: string;
}

export interface Template {
  id: string;
  name: string;
  content: string;
  offerType: OfferType;
  niche?: string;
  ownerId: string;
  createdAt?: string;
}

export interface BusinessLog {
  id: string;
  whatsappCount: number;
  emailCount: number;
  replies: number;
  followUps: number;
  calls: number;
  clients: number;
  revenue: number;
  xpEarned: number;
  date: string; // YYYY-MM-DD
  ownerId: string;
}

export interface PersonalHabit {
  id: string;
  type: 'reading' | 'workout' | 'bible';
  completed: boolean;
  notes?: string;
  xpEarned: number;
  date: string; // YYYY-MM-DD
  ownerId: string;
}

export interface ProjectTask {
  id: string;
  title: string;
  month: number; // 1-6
  completed: boolean;
  ownerId: string;
}

export interface DeploymentConfig {
  pacingDelay: number; // seconds
  autoPilot: boolean;
}
