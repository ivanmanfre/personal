import { LucideIcon } from "lucide-react";

export interface Service {
  title: string;
  description: string;
  icon: LucideIcon;
  tags: string[];
}

export interface CaseStudy {
  id: number;
  client: string;
  title: string;
  description: string;
  metrics: {
    label: string;
    value: string;
    suffix?: string;
  }[];
  before: string;
  after: string;
  image: string;
}

export interface TechItem {
  name: string;
  category: 'core' | 'automation' | 'ai' | 'crm' | 'comm';
  iconUrl?: string;
}

export interface Testimonial {
  name: string;
  role: string;
  company: string;
  content: string;
  image: string;
}

export type ProductCategory = 'workflow' | 'template' | 'agent';

export interface PricingTier {
  id: string;
  name: string;
  price: number | null; // null = custom pricing
  label: string; // e.g. "€297", "From €500"
  description: string;
  checkoutUrl: string; // LemonSqueezy URL or Calendly URL
  highlighted?: boolean;
}

export interface Product {
  slug: string;
  name: string;
  headline: string;
  description: string;
  category: ProductCategory;
  icon: LucideIcon;
  features: string[];
  includes: string[];
  setup: string[]; // required API keys & setup steps
  tiers: PricingTier[];
  previewImage?: string; // path to workflow/product screenshot
  sampleImage?: string; // path to sample output screenshot
  samplePdf?: string; // path to downloadable sample PDF
}