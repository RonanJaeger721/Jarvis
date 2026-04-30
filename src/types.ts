export type ContactStatus = "New" | "Opened" | "Contacted" | "Replied" | "Follow Up" | "Closed" | "Not Interested" | "Interested" | "Invalid";

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
  niche?: string;
  ownerId: string;
}

export interface DeploymentConfig {
  pacingDelay: number; // seconds
  autoPilot: boolean;
}
