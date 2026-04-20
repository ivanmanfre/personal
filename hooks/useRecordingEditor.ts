import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toastError, toastSuccess } from '../lib/dashboardActions';
import type { RecordingSegment, RecordingTranscript, TranscriptWord } from '../types/dashboard';

export interface EditorState {
  segments: RecordingSegment[];
  transcript: RecordingTranscript | null;
  words: TranscriptWord[];
  trimStart: number;
  trimEnd: number;
  currentTime: number;
  isPlaying: boolean;
  isTrimming: boolean;
  isAiProcessing: boolean;
  waveformData: number[];
}

function mapSegment(row: any): RecordingSegment {
  return {
    id: row.id,
    recordingId: row.recording_id,
    segmentType: row.segment_type,
    startTime: Number(row.start_time),
    endTime: Number(row.end_time),
    confidence: row.confidence ? Number(row.confidence) : null,
    label: row.label,
    isIncluded: row.is_included,
  };
}

function mapTranscript(row: any): RecordingTranscript {
  return {
    id: row.id,
    recordingId: row.recording_id,
    fullText: row.full_text,
    language: row.language,
    words: [],
  };
}

function mapWord(row: any): TranscriptWord {
  return {
    id: row.id,
    word: row.word,
    startTime: Number(row.start_time),
    endTime: Number(row.end_time),
    confidence: row.confidence ? Number(row.confidence) : null,
    wordIndex: row.word_index,
  };
}

export function useRecordingEditor(recordingId: string, duration: number) {
  const [segments, setSegments] = useState<RecordingSegment[]>([]);
  const [transcript, setTranscript] = useState<RecordingTranscript | null>(null);
  const [words, setWords] = useState<TranscriptWord[]>([]);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(duration);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTrimming, setIsTrimming] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Fetch segments + transcript
  const fetchEditorData = useCallback(async () => {
    try {
      const [segRes, transRes] = await Promise.all([
        supabase.from('recording_segments').select('*').eq('recording_id', recordingId).order('start_time'),
        supabase.from('recording_transcripts').select('*').eq('recording_id', recordingId).limit(1).single(),
      ]);

      if (segRes.data) setSegments(segRes.data.map(mapSegment));

      if (transRes.data) {
        setTranscript(mapTranscript(transRes.data));
        // Fetch words
        const { data: wordsData } = await supabase
          .from('recording_transcript_words')
          .select('*')
          .eq('transcript_id', transRes.data.id)
          .order('word_index');
        if (wordsData) setWords(wordsData.map(mapWord));
      }
    } catch (err) {
      // Not all recordings have segments/transcripts yet
    }
  }, [recordingId]);

  useEffect(() => {
    fetchEditorData();
    setTrimStart(0);
    setTrimEnd(duration);
  }, [recordingId, duration, fetchEditorData]);

  // Generate fake waveform data from duration (real version would use Web Audio API)
  useEffect(() => {
    const bars = Math.max(80, Math.floor(duration * 2));
    const data = Array.from({ length: bars }, (_, i) => {
      // Create a semi-realistic waveform shape
      const t = i / bars;
      const base = 0.2 + Math.random() * 0.6;
      const envelope = Math.sin(t * Math.PI) * 0.3;
      return Math.min(1, Math.max(0.05, base + envelope));
    });
    setWaveformData(data);
  }, [duration]);

  // Bind to video element for time sync
  const bindVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (!el) return;
    const onTimeUpdate = () => setCurrentTime(el.currentTime);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
    };
  }, []);

  const seekTo = useCallback((time: number) => {
    setCurrentTime(time);
    if (videoRef.current) videoRef.current.currentTime = time;
  }, []);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) videoRef.current.play();
    else videoRef.current.pause();
  }, []);

  // Toggle segment inclusion
  const toggleSegment = useCallback(async (segmentId: string) => {
    const seg = segments.find((s) => s.id === segmentId);
    if (!seg) return;
    const newVal = !seg.isIncluded;
    setSegments((prev) => prev.map((s) => s.id === segmentId ? { ...s, isIncluded: newVal } : s));
    try {
      const { error } = await supabase
        .from('recording_segments')
        .update({ is_included: newVal })
        .eq('id', segmentId);
      if (error) throw error;
    } catch (err) {
      setSegments((prev) => prev.map((s) => s.id === segmentId ? { ...s, isIncluded: !newVal } : s));
      toastError('toggle segment', err);
    }
  }, [segments]);

  // Request AI trim (calls processor /trim endpoint via Supabase edge function or n8n)
  const requestAiTrim = useCallback(async () => {
    setIsAiProcessing(true);
    try {
      const { data, error } = await supabase.rpc('recording_request_ai_trim', {
        p_recording_id: recordingId,
      });
      if (error) throw error;
      toastSuccess('AI trim requested - processing...');
      // Poll for completion
      const poll = setInterval(async () => {
        const { data: rec } = await supabase
          .from('recordings')
          .select('status')
          .eq('id', recordingId)
          .single();
        if (rec?.status === 'ready') {
          clearInterval(poll);
          setIsAiProcessing(false);
          await fetchEditorData();
          toastSuccess('AI trim complete');
        } else if (rec?.status === 'error') {
          clearInterval(poll);
          setIsAiProcessing(false);
          toastError('AI trim failed');
        }
      }, 3000);
      // Safety timeout
      setTimeout(() => { clearInterval(poll); setIsAiProcessing(false); }, 120000);
    } catch (err) {
      setIsAiProcessing(false);
      toastError('request AI trim', err);
    }
  }, [recordingId, fetchEditorData]);

  // Manual trim - calls processor /trim endpoint
  const applyManualTrim = useCallback(async () => {
    if (trimStart >= trimEnd) {
      toastError('Invalid trim range');
      return;
    }
    setIsTrimming(true);
    try {
      const { data, error } = await supabase.rpc('recording_manual_trim', {
        p_recording_id: recordingId,
        p_start: trimStart,
        p_end: trimEnd,
      });
      if (error) throw error;
      toastSuccess('Trim applied - re-rendering...');
      // Poll for completion
      const poll = setInterval(async () => {
        const { data: rec } = await supabase
          .from('recordings')
          .select('status, duration_seconds')
          .eq('id', recordingId)
          .single();
        if (rec?.status === 'ready') {
          clearInterval(poll);
          setIsTrimming(false);
          if (rec.duration_seconds) setTrimEnd(Number(rec.duration_seconds));
          toastSuccess('Trim complete');
        } else if (rec?.status === 'error') {
          clearInterval(poll);
          setIsTrimming(false);
          toastError('Trim failed');
        }
      }, 3000);
      setTimeout(() => { clearInterval(poll); setIsTrimming(false); }, 120000);
    } catch (err) {
      setIsTrimming(false);
      toastError('apply trim', err);
    }
  }, [recordingId, trimStart, trimEnd]);

  return {
    segments, transcript, words, waveformData,
    trimStart, trimEnd, setTrimStart, setTrimEnd,
    currentTime, isPlaying, isTrimming, isAiProcessing,
    bindVideo, seekTo, togglePlay,
    toggleSegment, requestAiTrim, applyManualTrim,
    refresh: fetchEditorData,
  };
}
