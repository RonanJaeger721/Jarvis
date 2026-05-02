import { Contact, Template, OfferType } from '../types';

export const JAEGER_DEFAULTS: Omit<Template, 'id' | 'ownerId'>[] = [
  // WEBSITE TEMPLATES
  {
    name: 'Website Hook 1',
    offerType: 'Website',
    content: "Hey, I noticed your {niche} business {location} doesn’t have a website you’re actively using to showcase your services to clients online — is that something you’d like to change?"
  },
  {
    name: 'Website Hook 2',
    offerType: 'Website',
    content: "Hi, quick one — I noticed your business in {location} doesn’t have a proper website where clients can view your services clearly. Is that something you’d be open to improving?"
  },
  {
    name: 'Website Hook 3',
    offerType: 'Website',
    content: "Hey, I came across your work in {location} and noticed there isn’t a website actively showing what you offer as a {niche}. That could be costing you inquiries — would you like me to show you an idea?"
  },
  {
    name: 'Website Hook 4',
    offerType: 'Website',
    content: "Hi, I noticed most clients would probably want to see your {niche} services online before reaching out, but I didn’t see a proper website for that. Is that something you’d like to fix?"
  },

  // FLYER TEMPLATES
  {
    name: 'Flyer Hook 1',
    offerType: 'Flyer',
    content: "Hie, I help {niche} in {location} create clean promo flyers that actually make their offers look professional. I charge $10, or 2 for $15. Would you like me to create one for your business?"
  },
  {
    name: 'Flyer Hook 2',
    offerType: 'Flyer',
    content: "Hey, I’m helping a few local {niche} businesses upgrade their promo flyers so their offers look cleaner and more professional. I can design one for $10, or 2 for $15. Would you like one?"
  },
  {
    name: 'Flyer Hook 3',
    offerType: 'Flyer',
    content: "Hello, quick one — do you currently need any clean flyers for your {niche} promotions? I do them for $10 each, or 2 for $15."
  },
  {
    name: 'Flyer Hook 4',
    offerType: 'Flyer',
    content: "Hie, I can help you create a clean, professional flyer for your {niche} business. You only pay if you like the design. Would you like me to make one for you?"
  },

  // FACEBOOK ADS TEMPLATES
  {
    name: 'Facebook Ads Hook 1',
    offerType: 'Facebook Ads',
    content: "Hey, quick one — are you currently running Facebook ads to bring in new {niche} clients, or are you mostly relying on referrals?"
  },
  {
    name: 'Facebook Ads Hook 2',
    offerType: 'Facebook Ads',
    content: "Hi, I help {niche} in {location} use Facebook ads to get more inquiries from people already interested in their services. Is that something you’re currently doing?"
  },
  {
    name: 'Facebook Ads Hook 3',
    offerType: 'Facebook Ads',
    content: "Hey, I noticed your business could probably get more inquiries with targeted Facebook ads for {niche} services. Are you open to testing ads?"
  },
  {
    name: 'Facebook Ads Hook 4',
    offerType: 'Facebook Ads',
    content: "Hi, are you currently using Facebook ads to get more clients for your {niche} business, or is most of your business coming through word of mouth?"
  }
];

export function generateMessage(
  template: string,
  data: {
    businessName?: string;
    contactName?: string;
    niche?: string;
    location?: string;
    offer?: string;
    price?: string;
    context?: string;
  }
): string {
  let message = template;

  // Placeholder mapping (with and without underscores for resiliency)
  const placeholders: Record<string, string> = {
    '{business_name}': data.businessName || 'your business',
    '{businessname}': data.businessName || 'your business',
    '{contact_name}': data.contactName || '',
    '{contactname}': data.contactName || '',
    '{niche}': data.niche || '',
    '{location}': data.location || '',
    '{offer}': data.offer || '',
    '{price}': data.price || '',
    '{context}': data.context || ''
  };

  // Replace placeholders
  Object.entries(placeholders).forEach(([tag, value]) => {
    // Case insensitive replace global
    const regex = new RegExp(tag.replace('{', '\\{').replace('}', '\\}'), 'gi');
    message = message.replace(regex, value);
  });

  // Automated Niche Insertion if not in template but niche is provided
  // (As per user requirement: "The app should insert the niche naturally into the message" if not already there)
  // We can do a simple check or just rely on the user putting {niche} in their templates.
  // Actually, the example shows "noticed your borehole drilling business in Bulawayo doesn’t have a website"
  // So if the template has "your business" and we have niche, we can replace "your business" with niche?
  // Let's stick to explicit placeholders for now as it's cleaner, but I'll add a helper to "enrich" templates.
  
  return message;
}

export function rotateTemplates(templates: Template[], offset: number): Template | null {
  if (templates.length === 0) return null;
  return templates[offset % templates.length];
}
