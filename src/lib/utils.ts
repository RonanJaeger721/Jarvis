import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatZimbabweNumber(phone: string): string {
  // 1. Remove all non-numeric characters first
  let cleaned = phone.replace(/[^\d]/g, ''); 
  
  // 2. Handle international prefixing
  if (cleaned.startsWith('00263')) {
    cleaned = cleaned.substring(2); // turn 00263 into 263
  }
  
  // 3. Handle local leading zero (e.g., 077... -> 77...)
  if (cleaned.startsWith('0') && !cleaned.startsWith('00')) {
    cleaned = cleaned.substring(1);
  }
  
  // 4. Standard mobile format: 771234567 (9 digits) -> +263771234567
  if (cleaned.length === 9 && (cleaned.startsWith('71') || cleaned.startsWith('73') || cleaned.startsWith('77') || cleaned.startsWith('78'))) {
    return `+263${cleaned}`;
  }
  
  // 5. Already has country code but no '+': 26377... -> +26377...
  if (cleaned.startsWith('263')) {
    return `+${cleaned}`;
  }
  
  // 6. Fallback: If it's a 9-10 digit number starting with 7, assume Zim mobile
  if (cleaned.length >= 9 && cleaned.startsWith('7')) {
    return `+263${cleaned}`;
  }

  // 7. If it's already a full international number (e.g., +27 or +44), or something else
  return cleaned.startsWith('263') ? `+${cleaned}` : (cleaned.length > 5 ? `+263${cleaned}` : `+${cleaned}`);
}

export function cleanPhoneForWhatsApp(phone: string): string {
  const formatted = formatZimbabweNumber(phone);
  return formatted.replace('+', '');
}
