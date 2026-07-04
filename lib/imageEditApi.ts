// lib/imageEditApi.ts
import { supabase } from './supabase';

export interface SegmentReq { image_url: string; x: number; y: number; }
export interface EditReq {
  image_url: string;
  op: 'erase' | 'replace' | 'refine';
  mask_url?: string;
  prompt?: string;
  whole_image?: boolean;
  draft_id: string;
}

export function buildSegmentReq(imageUrl: string, x: number, y: number): SegmentReq {
  return { image_url: imageUrl, x: Math.round(x), y: Math.round(y) };
}

export function buildEditReq(a: {
  imageUrl: string; op: 'erase' | 'replace' | 'refine';
  maskUrl?: string; prompt?: string; wholeImage?: boolean; draftId: string;
}): EditReq {
  const req: EditReq = { image_url: a.imageUrl, op: a.op, draft_id: a.draftId };
  if (a.maskUrl) req.mask_url = a.maskUrl;
  if (a.prompt) req.prompt = a.prompt;
  if (a.wholeImage) req.whole_image = true;
  return req;
}

export async function segmentAt(req: SegmentReq) {
  const { data, error } = await supabase.functions.invoke('img-segment', { body: req });
  if (error) throw new Error(error.message || 'segment failed');
  if (!data?.mask_url) throw new Error(data?.error || 'no mask returned');
  return {
    maskUrl: data.mask_url as string,
    bbox: data.bbox as [number, number, number, number],
    objectClass: data.object_class as string | undefined,
  };
}

export async function editImage(req: EditReq) {
  const { data, error } = await supabase.functions.invoke('img-edit', { body: req });
  if (error) throw new Error(error.message || 'edit failed');
  if (!data?.result_url) throw new Error(data?.error || 'no result returned');
  return { resultUrl: data.result_url as string };
}
