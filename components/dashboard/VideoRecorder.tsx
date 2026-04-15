import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Circle, Square, Mic, MicOff, Loader2 } from 'lucide-react';

interface Props {
  onRecordingComplete: (file: File) => Promise<void>;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const VideoRecorder: React.FC<Props> = ({ onRecordingComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [withMic, setWithMic] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (previewRef.current && previewStream) {
      previewRef.current.srcObject = previewStream;
    }
  }, [previewStream]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    previewStream?.getTracks().forEach((t) => t.stop());
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });

      let combinedStream = screenStream;

      if (withMic) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const ctx = new AudioContext();
          const dest = ctx.createMediaStreamDestination();
          const systemAudio = screenStream.getAudioTracks();
          if (systemAudio.length > 0) {
            ctx.createMediaStreamSource(new MediaStream(systemAudio)).connect(dest);
          }
          ctx.createMediaStreamSource(micStream).connect(dest);
          combinedStream = new MediaStream([
            ...screenStream.getVideoTracks(),
            ...dest.stream.getAudioTracks(),
          ]);
        } catch {
          // Mic denied — continue with screen only
        }
      }

      setPreviewStream(combinedStream);
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';

      const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 3_000_000 });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        combinedStream.getTracks().forEach((t) => t.stop());
        setPreviewStream(null);
        setIsRecording(false);

        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 1000) return;

        const ext = mimeType.includes('webm') ? 'webm' : 'mp4';
        const file = new File([blob], `recording.${ext}`, { type: mimeType.split(';')[0] });

        setUploading(true);
        await onRecordingComplete(file);
        setUploading(false);
        setRecordingTime(0);
      };

      screenStream.getVideoTracks()[0].onended = () => {
        if (recorder.state === 'recording') recorder.stop();
      };

      recorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      // User cancelled
    }
  }, [withMic, onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  if (uploading) {
    return (
      <div className="flex items-center gap-2 text-sm text-blue-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Uploading recording...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {previewStream && (
        <video ref={previewRef} autoPlay muted className="w-full rounded-lg border border-zinc-700/50" />
      )}
      <div className="flex items-center gap-2">
        {!isRecording ? (
          <>
            <button
              onClick={startRecording}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 transition-colors"
            >
              <Circle className="w-3.5 h-3.5 fill-current" /> Record
            </button>
            <button
              onClick={() => setWithMic(!withMic)}
              className={`p-1.5 rounded-lg border transition-colors ${withMic ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}
              title={withMic ? 'Mic on' : 'Mic off'}
            >
              {withMic ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={stopRecording}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-500 transition-colors animate-pulse"
            >
              <Square className="w-3 h-3 fill-current" /> Stop
            </button>
            <span className="text-xs text-red-400 font-mono">{formatDuration(recordingTime)}</span>
          </>
        )}
      </div>
    </div>
  );
};

export default VideoRecorder;
