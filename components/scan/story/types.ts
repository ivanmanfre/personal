import type { SampleSlide } from '../../dev/scan-walkthrough/journey/samplePlan';

export interface ResourceOption {
 label: string; title: string;
 team?: {role:string;job:string}[];
 coveredRole?: string; coveredJob?: string;
 deliverables?: {label:string;value:string}[];
 review?: string;
 quote?: string; changes?: string; rights?: string;
 question?: string; people?: string; record?: string; recruitment?: string;
 sections?: {heading:string;body:string}[];
}
/** Reviewed editorial content, bound to one scan. Counts always come from the audit. */
export interface StoryEdition {
 version: 1;
 reviewStatus: 'draft'|'approved';
 slug: string;
 founderName: string;
 companyName: string;
 brand: string;
 art: 'creative'|'research'|'custom';
 post: string; plainPost:string; slides:SampleSlide[];
 magnet:string; magnetPost:string; keyword:string;
 message:string; reply:string; next:string; subject:string; email:string;
 contentHeading:string; contentWhy:string; magnetWhy:string;
 researchNote:string;
 sourceQuote:string;
 segments:{label:string;note:string}[];
 buyerRole:string;
 coldTrigger:string; coldMessage:string;
 newsletterNote:string; nurtureNote:string;
 resource:{title:string;mode:'planner'|'question'|'document';brand:{surface:string;ink:string;accent:string;logo?:string};options:ResourceOption[]};
 cover:{lines:[string,string];left:string;right:string;details:[string,string]};
 flow:{messages:[string,string,string,string];checks:[{label:string;value:string},{label:string;value:string},{label:string;value:string}];signal:string;callTitle:string;brief:string};
}
