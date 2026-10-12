export interface DtcComparisonSourceLink {
  url: string;
  entity_id: string;
  label?: string;
  excerpt?: string;
  checked_at?: string;
}

export interface DtcComparisonEvidenceImage {
  url: string;
  alt: string;
  source_id: string;
}

export interface DtcComparisonObservation {
  id: string;
  title: string;
  capability: string;
  relationship: 'close_alternative' | 'category_benchmark';
  store_names: { prospect: string; peer: string };
  store_domains: { prospect: string; peer: string };
  store_entity_ids: { prospect: string; peer: string };
  why_relevant: string;
  own_observation: string;
  peer_observation: string;
  proposed_test: string;
  source_links: DtcComparisonSourceLink[];
  limitations: string;
  evidence_images?: DtcComparisonEvidenceImage[];
}

export interface DtcComparisonV1 {
  version: 'dtc-comparison-v1';
  revision_id: string;
  base_fingerprint: string;
  observed_at: string;
  expires_at: string;
  status: 'approved';
  observations: DtcComparisonObservation[];
}
