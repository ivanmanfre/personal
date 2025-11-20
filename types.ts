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