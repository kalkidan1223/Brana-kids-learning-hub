import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdArrowBack, MdArrowForward, MdAdd, MdDelete,
  MdTextFields, MdImage, MdAudiotrack, MdVideocam, MdStyle,
  MdSave, MdArrowUpward, MdArrowDownward, MdUpload, MdClose, MdAutoAwesome,
  MdMic, MdStop, MdPlayArrow, MdPause, MdVolumeUp,
} from 'react-icons/md';
import axiosClient from '../../api/axiosClient';
import { resolveFileUrl } from '../../utils/fileUrl';
import BasicChildLessonExperience from '../child/BasicChildLessonExperience';
import { FIDEL_FAMILIES, ENGLISH_ALPHABET, findFidelFamily } from '../../utils/fidelData';
import {
  MATH_NUMBERS,
  MATH_SHAPES,
  MATH_OPERATIONS,
  SCIENCE_COLORS,
  SCIENCE_ANIMALS,
  SCIENCE_BODY_PARTS,
  SCIENCE_NATURE_FOOD,
} from '../../utils/subjectPresets';

const CONTENT_TYPES = [
  { id: 'card',  label: 'Learning Card',        icon: MdStyle,     desc: 'Character, number, or vocabulary card with symbol & meaning' },
  { id: 'text',  label: 'Text & Explanation',   icon: MdTextFields, desc: 'Simple explanations, stories, or instructions' },
  { id: 'audio', label: 'Audio & Pronunciation', icon: MdAudiotrack, desc: 'Voice recording or pronunciation guide' },
  { id: 'video', label: 'Video Demonstration',  icon: MdVideocam,  desc: 'Short engaging educational video' },
  { id: 'image', label: 'Picture / Illustration', icon: MdImage,   desc: 'Visual aid or diagram for children' },
];

const PRACTICE_TYPES = [
  { id: 'matching',        label: 'Matching Pairs',           icon: '🔗', desc: 'Connect matching words, pictures, or letters' },
  { id: 'listening',       label: 'Listen & Pick',            icon: '🎧', desc: 'Hear sound & pick matching word, animal, symbol, or letter' },
  { id: 'letter_tracing',  label: 'Write / Trace Sequence',   icon: '✏️', desc: 'Trace letters (ሀ, ሁ, ሂ...) or numbers in order' },
  { id: 'counting',        label: 'Counting Practice',        icon: '🔢', desc: 'Count items and pick the right number' },
  { id: 'multiple_choice', label: 'Multiple Choice',          icon: '❓', desc: 'Fun question with 4 answer options' },
  { id: 'drag_and_drop',   label: 'Put in Order',             icon: '📋', desc: 'Arrange letters or words in correct sequence' },
  { id: 'math_ops',        label: 'Math (+, -, ×, ÷)',        icon: '➕', desc: 'Visual addition, subtraction, multiplication & division' },
];

function move(arr, idx, dir) {
  const next = idx + dir;
  if (next < 0 || next >= arr.length) return arr;
  const copy = [...arr];
  [copy[idx], copy[next]] = [copy[next], copy[idx]];
  return copy;
}

// Shared file-upload button
function UploadButton({ onUploaded, accept = 'audio/*,image/*,.pdf,.mp4,.mov', label = 'Upload File' }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await axiosClient.post('/uploads/file', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUploaded(data.url || data.file_url || data.path || '');
    } catch (err) {
      alert(err.response?.data?.error || 'Upload failed. Try again.');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  return (
    <>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={handleFile} />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
      >
        <MdUpload />
        {busy ? 'Uploading…' : label}
      </button>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Voice & Audio Recorder / Uploader / Player Control
// Enables recording direct from mic, uploading audio files, or entering audio URLs
// Works both in compact mode (7-grid column) and expanded mode (tab detail view).
// ────────────────────────────────────────────────────────────────────────────
function VoiceAudioControl({
  audioUrl,
  onAudioChange,
  compact = false,
  symbol = '',
  word = '',
  orderName = '',
  fallbackSpeak = null,
}) {
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [tempUrl, setTempUrl] = useState('');

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const currentAudioRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Microphone access is not supported by this browser. Please use Chrome, Edge, or Firefox.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const chosenMime = mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: chosenMime });
        if (blob.size === 0) return;

        setUploading(true);
        try {
          const form = new FormData();
          const ext = chosenMime.includes('ogg') ? 'ogg' : chosenMime.includes('mp4') ? 'm4a' : 'webm';
          const file = new File([blob], `voice-${symbol || 'letter'}-${Date.now()}.${ext}`, {
            type: chosenMime.split(';')[0],
          });
          form.append('file', file);

          const { data } = await axiosClient.post('/uploads/file', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          const url = data.url || data.file_url || data.path;
          if (url) {
            onAudioChange(url);
          } else {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => onAudioChange(reader.result);
          }
        } catch (err) {
          console.warn('Backend upload failed, saving as local audio data URI:', err);
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = () => onAudioChange(reader.result);
        } finally {
          setUploading(false);
        }
      };

      recorder.start(100);
      setRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone error:', err);
      alert('Could not access microphone. Please allow microphone permissions in your browser address bar.');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }
    setRecording(false);
  };

  const togglePlay = () => {
    if (isPlaying) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      setIsPlaying(false);
      return;
    }
    if (audioUrl) {
      const resolved = resolveFileUrl(audioUrl);
      const audio = new Audio(resolved);
      currentAudioRef.current = audio;
      setIsPlaying(true);
      audio.play()
        .then(() => {
          audio.onended = () => setIsPlaying(false);
        })
        .catch((e) => {
          console.warn('Playback error:', e);
          setIsPlaying(false);
          if (fallbackSpeak) fallbackSpeak();
          else alert('Could not play audio. File may be unreachable.');
        });
    } else if (fallbackSpeak) {
      fallbackSpeak();
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await axiosClient.post('/uploads/file', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onAudioChange(data.url || data.file_url || data.path || '');
      setShowUrlModal(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Audio upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Compact Mode (for each of the 7 columns in the Grid View)
  if (compact) {
    return (
      <div className="space-y-1 w-full min-w-0">
        {/* If audio recorded/provided */}
        {audioUrl ? (
          <div className="flex items-center justify-between gap-1 p-1 bg-emerald-50 border border-emerald-300 rounded-lg text-[10px]">
            <button
              type="button"
              onClick={togglePlay}
              className="flex items-center gap-1 font-black text-emerald-800 hover:text-emerald-950 truncate cursor-pointer"
              title="Play voice recording"
            >
              <span>{isPlaying ? '⏸️' : '▶️'}</span>
              <span className="truncate">{isPlaying ? 'Stop' : 'Voice'}</span>
            </button>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setTempUrl(audioUrl);
                  setShowUrlModal(true);
                }}
                className="text-emerald-700 hover:text-emerald-900 font-bold px-0.5 cursor-pointer"
                title="Edit audio URL or replace file"
              >
                ✏️
              </button>
              <button
                type="button"
                onClick={() => {
                  if (currentAudioRef.current) currentAudioRef.current.pause();
                  setIsPlaying(false);
                  onAudioChange('');
                }}
                className="text-red-500 hover:text-red-700 font-black px-0.5 cursor-pointer"
                title="Delete voice recording"
              >
                ✕
              </button>
            </div>
          </div>
        ) : recording ? (
          <button
            type="button"
            onClick={stopRecording}
            className="w-full text-[10px] font-black py-1 px-1 bg-red-600 text-white rounded-lg animate-pulse flex items-center justify-center gap-1 shadow-sm cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            ⏹️ Stop ({recordingSeconds}s)
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={startRecording}
              disabled={uploading}
              className="flex-1 text-[10px] font-black py-1 px-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition shadow-xs flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
              title="Record your voice with microphone"
            >
              <span>🎙️</span>
              <span>{uploading ? '...' : 'Record'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTempUrl(audioUrl || '');
                setShowUrlModal(true);
              }}
              className="p-1 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 font-bold cursor-pointer"
              title="Upload audio file or enter URL"
            >
              📁
            </button>
          </div>
        )}

        {/* Mini test button */}
        <button
          type="button"
          onClick={togglePlay}
          className={`w-full text-[10px] font-bold py-1 px-1 rounded transition cursor-pointer truncate ${
            audioUrl
              ? 'bg-emerald-100/80 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
          }`}
          title={audioUrl ? 'Test your voice recording' : 'Test text-to-speech'}
        >
          {isPlaying ? '⏸️ Stop' : '🔊 Test'}
        </button>

        {/* Modal / Dialog for Custom URL & Upload */}
        {showUrlModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl p-4 shadow-xl border border-slate-200 w-full max-w-sm space-y-3 text-left">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-black text-slate-800 uppercase">
                  Audio for {symbol} ({orderName})
                </span>
                <button
                  type="button"
                  onClick={() => setShowUrlModal(false)}
                  className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Audio URL (Web link or file path)
                </label>
                <input
                  type="text"
                  value={tempUrl}
                  onChange={(e) => setTempUrl(e.target.value)}
                  placeholder="https://... or /uploads/..."
                  className="w-full text-xs p-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onAudioChange(tempUrl.trim());
                    setShowUrlModal(false);
                  }}
                  className="flex-1 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 cursor-pointer"
                >
                  Save URL
                </button>
                <label className="flex-1 text-center py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border rounded-xl text-xs font-bold cursor-pointer">
                  {uploading ? 'Uploading...' : 'Upload File'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full / Expanded Mode (for Tab View & Card block)
  return (
    <div className="space-y-2.5 bg-amber-50/50 p-3.5 rounded-xl border border-amber-200 min-w-0 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <label className="text-xs font-bold text-amber-900 block truncate">
          Audio & Voice Recording {orderName ? `(${orderName})` : ''}
        </label>
        {audioUrl ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0 w-fit">
            ✅ Voice Ready
          </span>
        ) : (
          <span className="text-[10px] text-amber-700 font-medium shrink-0">
            Record or upload audio
          </span>
        )}
      </div>

      {/* Recording & Playback Strip */}
      {recording ? (
        <div className="p-3 bg-red-50 border-2 border-red-300 rounded-xl flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
            <span className="text-xs font-black text-red-700">
              Recording with Microphone... ({recordingSeconds}s)
            </span>
          </div>
          <button
            type="button"
            onClick={stopRecording}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-lg shadow-sm cursor-pointer"
          >
            ⏹️ Stop Recording
          </button>
        </div>
      ) : audioUrl ? (
        <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={togglePlay}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg shadow-xs cursor-pointer shrink-0"
            >
              <span>{isPlaying ? '⏸️ Pause' : '▶️ Listen to Recording'}</span>
            </button>
            <span className="text-xs text-emerald-800 font-bold truncate">
              {audioUrl.startsWith('data:') ? '🎙️ Mic Recording' : audioUrl.split('/').pop()}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (currentAudioRef.current) currentAudioRef.current.pause();
              setIsPlaying(false);
              onAudioChange('');
            }}
            className="text-xs text-red-600 hover:text-red-800 font-bold px-2 py-1 cursor-pointer shrink-0"
          >
            🗑️ Remove
          </button>
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={startRecording}
            disabled={uploading}
            className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            <MdMic className="text-base" />
            <span>{uploading ? 'Processing audio...' : 'Record My Voice with Mic'}</span>
          </button>
        </div>
      )}

      {/* URL input - full width inside container */}
      <div>
        <input
          type="text"
          value={audioUrl || ''}
          onChange={(e) => onAudioChange(e.target.value)}
          placeholder="Audio URL (or upload audio file below)"
          className="w-full rounded-lg border border-amber-300 p-2 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
      </div>

      {/* Upload and Test buttons inside container boundary */}
      <div className="grid grid-cols-2 gap-2">
        <label className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs truncate">
          <MdUpload className="text-sm shrink-0" />
          <span className="truncate">Upload File</span>
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </label>
        <button
          type="button"
          onClick={togglePlay}
          className={`inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-bold cursor-pointer transition shadow-2xs truncate ${
            audioUrl
              ? 'border-emerald-400 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
          title={audioUrl ? 'Test your voice recording' : 'Test speech pronunciation'}
        >
          <span>{isPlaying ? '⏸️ Stop' : '🔊 Test'}</span>
        </button>
      </div>
      <p className="text-[11px] text-amber-700 font-medium">
        💡 Children will hear your recorded voice when tapping &quot;Say It!&quot; during the lesson.
      </p>
    </div>
  );
}

export default function BasicGuidedLessonBuilder({ initialCourseId, courses = [], onCancel }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('active');

  // ── Step 1: Lesson Info ──────────────────────────────────────────────────
  const [info, setInfo] = useState({
    course_id: initialCourseId || (courses[0]?.course_id || ''),
    title: '',
    description: '',
    learning_objectives: '',
    estimated_duration_minutes: 15,
    order_index: 0,
  });

  // ── Step 2: Content Blocks ───────────────────────────────────────────────
  const [contentBlocks, setContentBlocks] = useState([
    {
      id: 'block-1',
      block_type: 'card',
      title: 'Introduction Card',
      symbol: '',
      word: '',
      translation: '',
      audio_url: '',
      description: '',
    },
  ]);

  // ── Step 3: Practice Activities ──────────────────────────────────────────
  const [practiceBlocks, setPracticeBlocks] = useState([]);

  // ── Fidel, English, Math & Science Pickers ─────────────────────────────
  const [fidelPickerOpen, setFidelPickerOpen] = useState(false);
  const [selectedFidelBase, setSelectedFidelBase] = useState('ሀ');
  const [englishPickerOpen, setEnglishPickerOpen] = useState(false);
  const [mathPickerOpen, setMathPickerOpen] = useState(false);
  const [mathTab, setMathTab] = useState('numbers'); // 'numbers', 'shapes', 'operations'
  const [sciencePickerOpen, setSciencePickerOpen] = useState(false);
  const [scienceTab, setScienceTab] = useState('colors'); // 'colors', 'animals', 'body', 'nature'
  const [selectedTargetBlockId, setSelectedTargetBlockId] = useState(null);

  const selectedCourse = courses.find((c) => String(c.course_id) === String(info.course_id));

  // Speech helper for live audio test inside the builder
  const speakWord = (text) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = /[\u1200-\u137F]/.test(text) ? 'am-ET' : 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  // ── Content block helpers ────────────────────────────────────────────────
  const addContentBlock = (type) => {
    const id = `block-${Date.now()}`;
    const base = { id, block_type: type, title: '', description: '' };
    if (type === 'card')  return setContentBlocks(prev => [...prev, { ...base, title: 'Learning Card', symbol: '', word: '', translation: '', audio_url: '' }]);
    if (type === 'text')  return setContentBlocks(prev => [...prev, { ...base, title: 'Read Along', content: '' }]);
    if (type === 'audio') return setContentBlocks(prev => [...prev, { ...base, title: 'Listen & Repeat', audio_url: '', transcript: '' }]);
    if (type === 'video') return setContentBlocks(prev => [...prev, { ...base, title: 'Fun Video', video_url: '', instructions: '' }]);
    if (type === 'image') return setContentBlocks(prev => [...prev, { ...base, title: 'Picture', file_url: '', caption: '' }]);
  };
  const removeContentBlock = (id) => setContentBlocks(prev => prev.filter(b => b.id !== id));
  const updateContentBlock = (id, field, value) =>
    setContentBlocks(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  const moveContent = (idx, dir) => setContentBlocks(prev => move(prev, idx, dir));

  // ── Fidel Family (Unified Card Block) helpers ────────────────────────────
  // Inserts ONE cohesive Fidel Family block holding all 7 forms, preventing jerky multi-card overflow!
  const insertFidelFamilyBlocks = (family, replaceFirstIfEmpty = true) => {
    if (!family || !family.forms) return;

    const newFamilyBlock = {
      id: `block-fidel-${family.base}-${Date.now()}`,
      block_type: 'fidel_family',
      title: `የ${family.base} ቤተሰብ (${family.name})`,
      family_base: family.base,
      family_name: family.name,
      forms: family.forms.map((f) => ({
        symbol: f.symbol,
        order: f.order,
        sound: f.sound,
        word: f.word,
        translation: f.translation,
        audio_url: '',
      })),
      activeFormIndex: 0,
      viewMode: 'tabs', // 'tabs' or 'grid'
      description: `የ${family.base} ቤተሰብ (7 forms: ${family.forms.map(f => f.symbol).join(', ')})`,
    };

    setContentBlocks((prev) => {
      if (replaceFirstIfEmpty && prev.length === 1 && prev[0].block_type === 'card' && !prev[0].symbol && !prev[0].word) {
        return [newFamilyBlock];
      }
      return [...prev, newFamilyBlock];
    });

    if (!info.title.trim()) {
      setInfo((prev) => ({ ...prev, title: `የፊደል ትምህርት: የ${family.base} ቤተሰብ (${family.name})` }));
    }
    setFidelPickerOpen(false);
  };

  const convertCardToFidelFamily = (blockId, family) => {
    if (!family || !family.forms) return;
    setContentBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === blockId);
      if (idx === -1) return prev;

      const newFamilyBlock = {
        id: prev[idx].id || `block-fidel-${family.base}-${Date.now()}`,
        block_type: 'fidel_family',
        title: `የ${family.base} ቤተሰብ (${family.name})`,
        family_base: family.base,
        family_name: family.name,
        forms: family.forms.map((f) => ({
          symbol: f.symbol,
          order: f.order,
          sound: f.sound,
          word: f.word,
          translation: f.translation,
          audio_url: '',
        })),
        activeFormIndex: 0,
        viewMode: 'tabs',
        description: `የ${family.base} ቤተሰብ (7 forms: ${family.forms.map(f => f.symbol).join(', ')})`,
      };

      const copy = [...prev];
      copy.splice(idx, 1, newFamilyBlock);
      return copy;
    });

    if (!info.title.trim()) {
      setInfo((prev) => ({ ...prev, title: `የፊደል ትምህርት: የ${family.base} ቤተሰብ (${family.name})` }));
    }
  };

  const updateFidelFamilyForm = (blockId, formIdx, field, value) => {
    setContentBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        const newForms = [...(b.forms || [])];
        if (newForms[formIdx]) {
          newForms[formIdx] = { ...newForms[formIdx], [field]: value };
        }
        return { ...b, forms: newForms };
      })
    );
  };

  const setFidelFamilyActiveIndex = (blockId, formIdx) => {
    setContentBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, activeFormIndex: formIdx } : b))
    );
  };

  const toggleFidelFamilyViewMode = (blockId) => {
    setContentBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId ? { ...b, viewMode: b.viewMode === 'grid' ? 'tabs' : 'grid' } : b
      )
    );
  };

  const unpackFidelFamilyToIndividualCards = (blockId) => {
    setContentBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === blockId);
      if (idx === -1) return prev;
      const b = prev[idx];
      const unpackedCards = (b.forms || []).map((f, i) => ({
        id: `block-fidel-${Date.now()}-${i}`,
        block_type: 'card',
        title: `${f.symbol} (${f.order})`,
        symbol: f.symbol,
        word: f.word,
        translation: f.translation,
        description: `${b.family_name || 'Fidel'} - ${f.order} (${f.sound || ''})`,
        audio_url: f.audio_url || '',
      }));
      const copy = [...prev];
      copy.splice(idx, 1, ...unpackedCards);
      return copy;
    });
  };

  const insertSingleFidelCard = (form, family) => {
    const newCard = {
      id: `block-fidel-${Date.now()}`,
      block_type: 'card',
      title: `${form.symbol} (${form.order})`,
      symbol: form.symbol,
      word: form.word,
      translation: form.translation,
      description: `${family.name} - ${form.order} (${form.sound})`,
      audio_url: '',
    };

    setContentBlocks((prev) => {
      if (selectedTargetBlockId) {
        return prev.map((b) => (b.id === selectedTargetBlockId ? { ...b, ...newCard, id: b.id } : b));
      }
      if (prev.length === 1 && prev[0].block_type === 'card' && !prev[0].symbol && !prev[0].word) {
        return [newCard];
      }
      return [...prev, newCard];
    });

    setSelectedTargetBlockId(null);
    setFidelPickerOpen(false);
  };

  // ── English Alphabet Card helper ─────────────────────────────────────────
  const insertEnglishLetterCard = (item) => {
    const newCard = {
      id: `block-en-${Date.now()}`,
      block_type: 'card',
      title: `Letter ${item.letter}`,
      symbol: item.letter,
      word: item.word,
      translation: item.translation,
      description: `English Alphabet: ${item.letter} is for ${item.word}`,
      audio_url: '',
    };

    setContentBlocks((prev) => {
      if (selectedTargetBlockId) {
        return prev.map((b) => (b.id === selectedTargetBlockId ? { ...b, ...newCard, id: b.id } : b));
      }
      if (prev.length === 1 && prev[0].block_type === 'card' && !prev[0].symbol && !prev[0].word) {
        return [newCard];
      }
      return [...prev, newCard];
    });

    if (!info.title.trim()) {
      setInfo((prev) => ({ ...prev, title: `English Letter: ${item.letter}` }));
    }
    setSelectedTargetBlockId(null);
    setEnglishPickerOpen(false);
  };

  // ── Mathematics Card helper ──────────────────────────────────────────────
  const insertMathCard = (item) => {
    const newCard = {
      id: `block-math-${Date.now()}`,
      block_type: 'card',
      title: `${item.word} (${item.symbol})`,
      symbol: item.symbol,
      word: item.word,
      translation: item.amharic || (item.dots ? `${item.amharic} · ${item.dots}` : ''),
      description: item.desc || `Mathematics: ${item.symbol} represents ${item.word}`,
      audio_url: '',
    };

    setContentBlocks((prev) => {
      if (selectedTargetBlockId) {
        return prev.map((b) => (b.id === selectedTargetBlockId ? { ...b, ...newCard, id: b.id } : b));
      }
      if (prev.length === 1 && prev[0].block_type === 'card' && !prev[0].symbol && !prev[0].word) {
        return [newCard];
      }
      return [...prev, newCard];
    });

    if (!info.title.trim()) {
      setInfo((prev) => ({ ...prev, title: `Math Concept: ${item.word} (${item.symbol})` }));
    }
    setSelectedTargetBlockId(null);
    setMathPickerOpen(false);
  };

  const insertNumberSequence = (count = 5) => {
    const selected = MATH_NUMBERS.slice(1, count + 1); // e.g. 1 to 5 or 1 to 10
    const newCards = selected.map((item, i) => ({
      id: `block-num-${Date.now()}-${i}`,
      block_type: 'card',
      title: `Number ${item.symbol}: ${item.word}`,
      symbol: item.symbol,
      word: item.word,
      translation: `${item.amharic} · ${item.dots}`,
      description: item.desc,
      audio_url: '',
    }));

    setContentBlocks((prev) => {
      if (prev.length === 1 && prev[0].block_type === 'card' && !prev[0].symbol && !prev[0].word) {
        return newCards;
      }
      return [...prev, ...newCards];
    });

    if (!info.title.trim()) {
      setInfo((prev) => ({ ...prev, title: `Counting Numbers 1 to ${count}` }));
    }
    setMathPickerOpen(false);
  };

  // ── Science & General Knowledge Card helper ──────────────────────────────
  const insertScienceCard = (item) => {
    const newCard = {
      id: `block-sci-${Date.now()}`,
      block_type: 'card',
      title: `${item.symbol} ${item.word}`,
      symbol: item.symbol,
      word: item.word,
      translation: item.amharic,
      description: item.desc || `General Knowledge: ${item.word}`,
      audio_url: '',
    };

    setContentBlocks((prev) => {
      if (selectedTargetBlockId) {
        return prev.map((b) => (b.id === selectedTargetBlockId ? { ...b, ...newCard, id: b.id } : b));
      }
      if (prev.length === 1 && prev[0].block_type === 'card' && !prev[0].symbol && !prev[0].word) {
        return [newCard];
      }
      return [...prev, newCard];
    });

    if (!info.title.trim()) {
      setInfo((prev) => ({ ...prev, title: `Learn About: ${item.word} (${item.symbol})` }));
    }
    setSelectedTargetBlockId(null);
    setSciencePickerOpen(false);
  };

  // ── Practice block helpers ───────────────────────────────────────────────
  const addPracticeBlock = (type) => {
    const id = `practice-${Date.now()}`;
    const base = { id, activity_type: type, title: '', instructions: 'Choose the correct answer' };
    if (type === 'matching')        return setPracticeBlocks(prev => [...prev, { ...base, title: 'Match the Pairs', pairs: [{ left: '', right: '' }, { left: '', right: '' }] }]);
    if (type === 'counting')        return setPracticeBlocks(prev => [...prev, { ...base, title: 'Counting Fun', target_count: 3, item_emoji: '⭐', options: ['1', '2', '3', '4'], correct_answer: '3' }]);
    if (type === 'multiple_choice') return setPracticeBlocks(prev => [...prev, { ...base, title: 'Practice Question', question: '', options: ['', '', '', ''], correct_answer: '' }]);
    if (type === 'drag_and_drop')   return setPracticeBlocks(prev => [...prev, { ...base, title: 'Put in Order', items: ['', '', ''], correct_order: ['', '', ''] }]);
    if (type === 'listening')       return setPracticeBlocks(prev => [...prev, { ...base, title: 'Listen & Pick', activity_type: 'listening', instructions: 'Tap the speaker, listen carefully, then pick the matching answer!', question: 'What did you hear?', audio_url: '', audio_sound: 'ሀ', options: ['ሀ', 'ሁ', 'ሂ', 'ሃ'], correct_answer: 'ሀ' }]);
    if (type === 'letter_tracing')  return setPracticeBlocks(prev => [...prev, { ...base, title: 'Write & Trace Sequence', activity_type: 'letter_tracing', instructions: 'Use your finger or mouse to trace each character carefully!', trace_chars: ['ሀ', 'ሁ', 'ሂ', 'ሃ', 'ሄ', 'ህ', 'ሆ'], trace_char: 'ሀ', guide_word: 'ሀገር', guide_sound: 'Ha' }]);
    if (type === 'math_ops')        return setPracticeBlocks(prev => [...prev, { ...base, title: 'Math Practice', activity_type: 'counting', instructions: 'Solve the math problem and pick the correct answer!', is_math_operation: true, operation_a: 3, operation_b: 2, operator: '+', item_emoji: '🍎', options: ['4', '5', '6', '7'], correct_answer: '5', problems: [{ id: `prob-${Date.now()}-1`, operation_a: 3, operation_b: 2, operator: '+', item_emoji: '🍎', options: ['4', '5', '6', '7'], correct_answer: '5', question: 'What is 3 + 2?' }] }]);
  };
  const removePracticeBlock = (id) => setPracticeBlocks(prev => prev.filter(p => p.id !== id));
  const updatePracticeBlock = (id, field, value) =>
    setPracticeBlocks(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  const movePractice = (idx, dir) => setPracticeBlocks(prev => move(prev, idx, dir));

  // ── Build preview resources for Step 4 ──────────────────────────────────
  // Must match the shape BasicChildLessonExperience reads: resource.content.metadata etc.
  const buildPreviewResources = () => {
    const res = [];
    contentBlocks.forEach((b) => {
      if (b.block_type === 'fidel_family') {
        (b.forms || []).forEach((f, fIdx) => {
          res.push({
            id: `${b.id}-${fIdx}`,
            resource_type: 'material',
            title: `${f.symbol} (${f.order})`,
            description: `${b.family_name || b.title} - ${f.order} (${f.sound || ''})`,
            status: 'not_started',
            content: {
              material_type: 'other',
              metadata: {
                type: 'learning_card',
                card_type: 'fidel',
                symbol: f.symbol,
                word: f.word,
                translation: f.translation,
                audio_url: f.audio_url || '',
                family_base: b.family_base,
                order: f.order,
              },
              text_content: `${f.symbol} - ${f.word || ''} (${f.translation || ''})`,
            },
          });
        });
      } else if (b.block_type === 'card') {
        res.push({
          id: b.id, resource_type: 'material',
          title: b.title || 'Learning Card',
          description: b.description || '',
          status: 'not_started',
          content: {
            material_type: 'other',
            metadata: { type: 'learning_card', symbol: b.symbol, word: b.word, translation: b.translation, audio_url: b.audio_url },
            text_content: b.description || `${b.symbol || ''} - ${b.word || ''}`,
          },
        });
      } else if (b.block_type === 'text') {
        res.push({
          id: b.id, resource_type: 'material',
          title: b.title || 'Read Along',
          status: 'not_started',
          content: { material_type: 'document', text_content: b.content || '', metadata: { type: 'text_block' } },
        });
      } else if (b.block_type === 'audio') {
        res.push({
          id: b.id, resource_type: 'material',
          title: b.title || 'Listen & Speak',
          status: 'not_started',
          content: { material_type: 'audio', file_url: b.audio_url || '', text_content: b.transcript || '', metadata: { type: 'audio_block' } },
        });
      } else if (b.block_type === 'video') {
        res.push({
          id: b.id, resource_type: 'video',
          title: b.title || 'Demonstration Video',
          status: 'not_started',
          content: { video_url: b.video_url || '', source_type: 'youtube' },
        });
      } else if (b.block_type === 'image') {
        res.push({
          id: b.id, resource_type: 'material',
          title: b.title || 'Illustration',
          description: b.caption || '',
          status: 'not_started',
          content: { material_type: 'image', file_url: b.file_url || '', text_content: b.caption || '', metadata: { type: 'image_block' } },
        });
      }
    });
    practiceBlocks.forEach((p) => {
      res.push({
        id: p.id, resource_type: 'activity',
        title: p.title || 'Fun Practice',
        status: 'not_started',
        content: {
          activity_type: p.activity_type,
          instructions: p.instructions || '',
          max_score: 10,
          activity_config: {
            question: p.question,
            options: p.options,
            correct_answer: p.correct_answer,
            pairs: p.pairs,
            target_count: p.target_count,
            items: p.items,
            correct_order: p.correct_order,
            audio_url: p.audio_url || '',
            audio_sound: p.audio_sound || '',
            trace_char: p.trace_char || '',
            trace_chars: p.trace_chars || (p.trace_char ? [p.trace_char] : ['ሀ']),
            guide_word: p.guide_word || '',
            sound: p.guide_sound || p.sound || '',
            is_math_operation: p.is_math_operation || false,
            operation_a: p.operation_a,
            operation_b: p.operation_b,
            operator: p.operator || '+',
            item_emoji: p.item_emoji || '⭐',
            problems: p.problems || (p.is_math_operation ? [{
              operation_a: p.operation_a ?? 3,
              operation_b: p.operation_b ?? 2,
              operator: p.operator || '+',
              item_emoji: p.item_emoji || '🍎',
              options: p.options || ['4', '5', '6', '7'],
              correct_answer: p.correct_answer || '5',
              question: p.question || `What is ${p.operation_a ?? 3} ${p.operator || '+'} ${p.operation_b ?? 2}?`,
            }] : []),
          },
        },
      });
    });
    return res;
  };

  // ── Save & Publish ───────────────────────────────────────────────────────
  const handleSaveAndPublish = async () => {
    setError('');
    if (!info.course_id) { setError('Please select a course.'); setStep(1); return; }
    if (!info.title.trim()) { setError('Please provide a lesson title.'); setStep(1); return; }
    setSaving(true);
    try {
      // 1. Create lesson
      const { data: lessonData } = await axiosClient.post(`/courses/${info.course_id}/lessons`, {
        title: info.title.trim(),
        description: info.description.trim() || null,
        learning_objectives: info.learning_objectives.trim() || null,
        estimated_duration_minutes: Number(info.estimated_duration_minutes) || 15,
        order_index: Number(info.order_index) || 0,
        status,
        difficulty_level: 'beginner',
      });
      const lesson = lessonData.lesson;

      // 2. Create content blocks
      for (const b of contentBlocks) {
        if (b.block_type === 'fidel_family') {
          for (const f of (b.forms || [])) {
            const payload = {
              title: `${f.symbol} (${f.order}) - የ${b.family_base} ቤተሰብ`,
              description: `${b.family_name || b.title} - ${f.order} (${f.sound || ''})`,
              type: 'other',
              content: `${f.symbol} - ${f.word || ''} (${f.translation || ''})`,
              file_url: f.audio_url || null,
              metadata: {
                type: 'learning_card',
                card_type: 'fidel',
                symbol: f.symbol,
                word: f.word,
                translation: f.translation,
                audio_url: f.audio_url || '',
                family_base: b.family_base,
                order: f.order,
              },
            };
            await axiosClient.post(`/lessons/${lesson.id}/materials`, payload);
          }
        } else if (b.block_type === 'video') {
          if (!b.video_url?.trim()) continue;
          await axiosClient.post(`/lessons/${lesson.id}/videos`, {
            title: b.title.trim() || 'Video Lesson',
            video_url: b.video_url.trim(),
            description: b.instructions || null,
            source_type: b.video_url.includes('youtube') || b.video_url.includes('youtu.be') ? 'youtube'
              : b.video_url.includes('vimeo') ? 'vimeo' : 'upload',
          });
        } else {
          const payload = {
            title: b.title.trim() || (b.block_type === 'card' ? `Card: ${b.symbol || b.word}` : b.block_type),
            description: b.description || b.caption || b.transcript || null,
            type: b.block_type === 'card' ? 'other' : b.block_type === 'text' ? 'document' : b.block_type,
            content: b.block_type === 'text' ? (b.content || '') : b.block_type === 'audio' ? (b.transcript || '') : null,
            file_url: b.audio_url || b.file_url || null,
            metadata: b.block_type === 'card'
              ? { type: 'learning_card', symbol: b.symbol, word: b.word, translation: b.translation, audio_url: b.audio_url }
              : { type: `${b.block_type}_block` },
          };
          await axiosClient.post(`/lessons/${lesson.id}/materials`, payload);
        }
      }

      // 3. Create practice activities
      for (const p of practiceBlocks) {
        const config = {
          question: p.question || p.instructions,
          options: p.options || [],
          correct_answer: p.correct_answer,
          pairs: p.pairs || [],
          target_count: p.target_count || 1,
          items: p.items || [],
          correct_order: p.correct_order || [],
          audio_url: p.audio_url || '',
          audio_sound: p.audio_sound || '',
          trace_char: p.trace_char || '',
          trace_chars: p.trace_chars || (p.trace_char ? [p.trace_char] : ['ሀ']),
          guide_word: p.guide_word || '',
          sound: p.guide_sound || p.sound || '',
          is_math_operation: p.is_math_operation || false,
          operation_a: p.operation_a,
          operation_b: p.operation_b,
          operator: p.operator || '+',
          item_emoji: p.item_emoji || '⭐',
          problems: p.problems || (p.is_math_operation ? [{
            operation_a: p.operation_a ?? 3,
            operation_b: p.operation_b ?? 2,
            operator: p.operator || '+',
            item_emoji: p.item_emoji || '🍎',
            options: p.options || ['4', '5', '6', '7'],
            correct_answer: p.correct_answer || '5',
            question: p.question || `What is ${p.operation_a ?? 3} ${p.operator || '+'} ${p.operation_b ?? 2}?`,
          }] : []),
        };
        await axiosClient.post(`/lessons/${lesson.id}/activities`, {
          title: p.title.trim() || 'Fun Practice',
          activity_type: p.activity_type,
          instructions: p.instructions || 'Follow the instructions to complete the exercise',
          activity_config: config,
          max_score: 10,
          auto_gradable: true,
        });
      }

      navigate(`/instructor/courses/${lesson.course_id}/lessons/${lesson.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save lesson and content');
      setSaving(false);
    }
  };

  // ── Shared nav buttons ───────────────────────────────────────────────────
  const NavBack = ({ to, label = 'Back' }) => (
    <button onClick={() => setStep(to)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition">
      <MdArrowBack /> {label}
    </button>
  );
  const NavNext = ({ to, label = 'Next', validate }) => (
    <button onClick={() => { if (validate) { const err = validate(); if (err) { setError(err); return; } } setError(''); setStep(to); }}
      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black rounded-xl shadow hover:scale-105 transition">
      <span>{label}</span> <MdArrowForward />
    </button>
  );

  const courseTitle = (selectedCourse?.title || selectedCourse?.course_title || '').toLowerCase();
  const subjectName = (selectedCourse?.subject_name || '').toLowerCase();
  const isAmharicCourse = subjectName.includes('amh') || courseTitle.includes('amh') || courseTitle.includes('ፊደል');
  const isEnglishCourse = subjectName.includes('eng') || courseTitle.includes('eng');
  const isMathCourse = subjectName.includes('math') || courseTitle.includes('math') || courseTitle.includes('ሂሳብ');
  const isScienceCourse = subjectName.includes('sci') || courseTitle.includes('sci') || subjectName.includes('social') || courseTitle.includes('አካባቢ');

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden max-w-5xl mx-auto my-6">
      {/* Header / Stepper */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 p-6 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-block bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-2">
              Guided Lesson Builder · Basic Levels (KG1 – Grade 2)
            </span>
            <h2 className="text-2xl sm:text-3xl font-black drop-shadow-sm">Create an Interactive Child Lesson</h2>
            <p className="text-white/90 text-sm mt-1">Build a visual learning experience step by step.</p>
          </div>
          {onCancel && (
            <button onClick={onCancel} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl font-bold text-sm backdrop-blur transition">
              Cancel
            </button>
          )}
        </div>
        <div className="mt-6 grid grid-cols-5 gap-2 text-center text-xs font-bold">
          {[
            { n: 1, label: '1 · Info' },
            { n: 2, label: '2 · Content' },
            { n: 3, label: '3 · Practice' },
            { n: 4, label: '4 · Preview' },
            { n: 5, label: '5 · Publish' },
          ].map((s) => (
            <button key={s.n} onClick={() => setStep(s.n)}
              className={`py-2 rounded-xl transition flex flex-col items-center gap-1 ${step === s.n ? 'bg-white text-orange-600 shadow-lg font-black scale-105' : step > s.n ? 'bg-white/30 text-white hover:bg-white/40' : 'bg-black/10 text-white/60 hover:bg-black/20'}`}>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="m-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-xs uppercase font-bold underline">Dismiss</button>
        </div>
      )}

      {/* ── STEP 1: LESSON INFO ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-xl font-black text-slate-800">Step 1: Lesson Details</h3>
            <p className="text-sm text-slate-500 mt-1">Assign this lesson to a course and set its basic information.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase">Assigned Course *</label>
              <select
                value={info.course_id}
                onChange={(e) => setInfo({ ...info, course_id: e.target.value })}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-orange-400 focus:outline-none"
              >
                {courses.map((c) => (
                  <option key={c.course_id} value={c.course_id}>
                    {c.course_title} ({c.grade_level_name || 'Visual Level'})
                  </option>
                ))}
              </select>
              {selectedCourse && (
                <p className="text-xs text-orange-600 font-semibold mt-1">
                  {selectedCourse.grade_level_name || 'Basic Tier'} · {selectedCourse.subject_name || 'Core'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase">Lesson Order / Sequence</label>
              <input type="number" min="0" value={info.order_index}
                onChange={(e) => setInfo({ ...info, order_index: e.target.value })}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm font-semibold focus:ring-2 focus:ring-orange-400 focus:outline-none"
                placeholder="0" />
              <p className="text-xs text-slate-400">Position in the course (0 = first)</p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-700 uppercase">Lesson Title *</label>
              <input type="text" value={info.title}
                onChange={(e) => setInfo({ ...info, title: e.target.value })}
                placeholder="e.g. Counting 1 to 5 · Amharic Fidel ሀ ቤተሰብ · English Alphabet A"
                className="w-full rounded-xl border border-slate-300 p-3 text-base font-bold text-slate-800 focus:ring-2 focus:ring-orange-400 focus:outline-none" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-700 uppercase">Child-Friendly Description</label>
              <textarea rows={2} value={info.description}
                onChange={(e) => setInfo({ ...info, description: e.target.value })}
                placeholder="A warm, encouraging welcome for young learners..."
                className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-700 focus:ring-2 focus:ring-orange-400 focus:outline-none" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-700 uppercase">Learning Objectives</label>
              <input type="text" value={info.learning_objectives}
                onChange={(e) => setInfo({ ...info, learning_objectives: e.target.value })}
                placeholder="e.g. Recognize and pronounce ሀ, count up to 5 items"
                className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-700 focus:ring-2 focus:ring-orange-400 focus:outline-none" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase">Duration (minutes)</label>
              <input type="number" min="5" max="60" value={info.estimated_duration_minutes}
                onChange={(e) => setInfo({ ...info, estimated_duration_minutes: e.target.value })}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm font-semibold focus:ring-2 focus:ring-orange-400 focus:outline-none" />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <NavNext to={2} label="Next: Add Learning Content"
              validate={() => !info.title.trim() ? 'Please fill in the lesson title' : !info.course_id ? 'Please select a course' : null} />
          </div>
        </div>
      )}

      {/* ── STEP 2: CONTENT BLOCKS ──────────────────────────────────────── */}
      {step === 2 && (
        <div className="p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-800">Step 2: Add Learning Content</h3>
              <p className="text-sm text-slate-500 mt-1">Choose blocks below. The child sees them in this exact order. Reorder with ↑↓.</p>
            </div>
            <span className="text-xs font-bold bg-orange-100 text-orange-800 px-3 py-1.5 rounded-full">{contentBlocks.length} Block{contentBlocks.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Block type picker with Subject-Aware Studios */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <span>➕ Add Learning Content:</span>
                  {selectedCourse?.title && (
                    <span className="text-[10px] font-bold text-slate-500 normal-case bg-slate-200/70 px-2 py-0.5 rounded-md">
                      Course: {selectedCourse.title}
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-slate-500">Pick standard blocks or launch quick subject card generators:</p>
              </div>

              {/* 4 Quick Subject Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Amharic Fidel Family */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTargetBlockId(null);
                    setFidelPickerOpen(true);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black shadow-xs transition hover:scale-102 ${
                    isAmharicCourse
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white ring-2 ring-amber-300 shadow-md'
                      : 'bg-amber-100/90 text-amber-900 hover:bg-amber-200 border border-amber-300'
                  }`}
                  title="Insert full 7-order Amharic Fidel family as one unified card"
                >
                  <MdAutoAwesome className="text-sm" />
                  <span>Insert Fidel Family (ሀ, ሁ, ሂ...)</span>
                  {isAmharicCourse && <span className="bg-white/30 text-[9px] px-1.5 py-0.5 rounded-full font-extrabold uppercase">Subject Best</span>}
                </button>

                {/* 2. English Alphabet */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTargetBlockId(null);
                    setEnglishPickerOpen(true);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black shadow-xs transition hover:scale-102 ${
                    isEnglishCourse
                      ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white ring-2 ring-indigo-300 shadow-md'
                      : 'bg-indigo-50 text-indigo-900 hover:bg-indigo-100 border border-indigo-200'
                  }`}
                  title="Insert English Alphabet cards A-Z"
                >
                  <span>🔤</span>
                  <span>Insert English Letter (A–Z)</span>
                  {isEnglishCourse && <span className="bg-white/30 text-[9px] px-1.5 py-0.5 rounded-full font-extrabold uppercase">Subject Best</span>}
                </button>

                {/* 3. Numbers & Mathematics */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTargetBlockId(null);
                    setMathPickerOpen(true);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black shadow-xs transition hover:scale-102 ${
                    isMathCourse
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white ring-2 ring-emerald-300 shadow-md'
                      : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                  title="Insert Number (0-20), Shapes, or Math Operations"
                >
                  <span>🔢</span>
                  <span>Insert Number & Math</span>
                  {isMathCourse && <span className="bg-white/30 text-[9px] px-1.5 py-0.5 rounded-full font-extrabold uppercase">Subject Best</span>}
                </button>

                {/* 4. Science & General Knowledge */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTargetBlockId(null);
                    setSciencePickerOpen(true);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black shadow-xs transition hover:scale-102 ${
                    isScienceCourse
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white ring-2 ring-purple-300 shadow-md'
                      : 'bg-purple-50 text-purple-900 hover:bg-purple-100 border border-purple-200'
                  }`}
                  title="Insert Colors, Animals, Body Parts, or Everyday Nature cards"
                >
                  <span>🌍</span>
                  <span>Insert Science & GK</span>
                  {isScienceCourse && <span className="bg-white/30 text-[9px] px-1.5 py-0.5 rounded-full font-extrabold uppercase">Subject Best</span>}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-1">
              {CONTENT_TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <button key={t.id} onClick={() => addContentBlock(t.id)}
                    className="flex flex-col items-center text-center p-3 rounded-xl bg-white border border-slate-200 hover:border-orange-400 hover:bg-orange-50/50 shadow-xs transition group">
                    <Icon className="text-2xl text-orange-500 group-hover:scale-110 transition" />
                    <span className="text-xs font-extrabold text-slate-800 mt-1">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {contentBlocks.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center text-slate-400">
              <p className="text-4xl mb-2">📚</p>
              <p className="font-semibold">Add at least one content block above to build the lesson.</p>
            </div>
          )}

          <div className="space-y-4">
            {contentBlocks.map((b, idx) => (
              <div key={b.id} className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm space-y-4">
                {/* Block header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-orange-500 text-white text-xs font-black flex items-center justify-center">{idx + 1}</span>
                    <span className="text-xs font-black uppercase tracking-wider text-orange-600 bg-orange-50 px-2.5 py-1 rounded-md">{b.block_type.toUpperCase()}</span>
                    <input type="text" value={b.title}
                      onChange={(e) => updateContentBlock(b.id, 'title', e.target.value)}
                      placeholder="Block title..."
                      className="font-bold text-slate-800 text-sm border-b border-dashed border-slate-300 focus:outline-none focus:border-orange-500 px-1" />
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveContent(idx, -1)} disabled={idx === 0} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30" title="Move up"><MdArrowUpward /></button>
                    <button onClick={() => moveContent(idx, 1)} disabled={idx === contentBlocks.length - 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30" title="Move down"><MdArrowDownward /></button>
                    <button onClick={() => removeContentBlock(b.id)} className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50" title="Remove"><MdDelete className="text-lg" /></button>
                  </div>
                </div>

                {/* ── UNIFIED FIDEL FAMILY BLOCK (All 7 Forms in 1 Card!) ── */}
                {b.block_type === 'fidel_family' && (
                  <div className="space-y-4 bg-gradient-to-br from-amber-50/90 to-orange-50/70 p-5 rounded-2xl border-2 border-amber-300 shadow-xs">
                    {/* Header of Fidel Family block */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200/80 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-3xl font-black text-amber-600 bg-white px-3 py-1.5 rounded-xl border border-amber-200 shadow-xs">
                          {b.family_base}
                        </span>
                        <div>
                          <h4 className="text-sm font-black text-amber-950 flex items-center gap-2">
                            <span>የ{b.family_base} ቤተሰብ ({b.family_name})</span>
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-300">
                              Complete 7 Forms
                            </span>
                          </h4>
                          <p className="text-xs text-amber-800 mt-0.5">
                            All 7 phonetic orders are unified in this single card. Children learn the full family rhythm without clutter!
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleFidelFamilyViewMode(b.id)}
                          className="text-xs font-bold px-3 py-1.5 bg-white border border-amber-300 text-amber-900 rounded-xl hover:bg-amber-100/70 transition shadow-xs"
                        >
                          {b.viewMode === 'grid' ? '📑 Switch to Tab View' : '▦ View All 7 in Grid'}
                        </button>
                        <button
                          type="button"
                          onClick={() => unpackFidelFamilyToIndividualCards(b.id)}
                          className="text-xs font-bold px-2.5 py-1.5 text-amber-700 hover:text-amber-950 hover:underline"
                          title="Split into 7 separate card blocks if you prefer"
                        >
                          Unpack to 7 Blocks
                        </button>
                      </div>
                    </div>

                    {/* The 7-Family Horizontal Strip / Tabs */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                        <span>Click a letter below to inspect & edit:</span>
                        <span>
                          Active: <strong>{b.forms?.[b.activeFormIndex || 0]?.symbol}</strong> ({b.forms?.[b.activeFormIndex || 0]?.order} - {b.forms?.[b.activeFormIndex || 0]?.sound})
                        </span>
                      </div>

                      <div className="grid grid-cols-7 gap-1.5 p-2 bg-white/90 rounded-2xl border border-amber-200 shadow-inner">
                        {(b.forms || []).map((f, fIdx) => {
                          const isActive = (b.activeFormIndex || 0) === fIdx;
                          return (
                            <button
                              key={f.symbol}
                              type="button"
                              onClick={() => setFidelFamilyActiveIndex(b.id, fIdx)}
                              className={`py-2 px-1 rounded-xl text-center transition flex flex-col items-center justify-center relative ${
                                isActive
                                  ? 'bg-amber-500 text-white shadow-md ring-2 ring-amber-300 scale-102'
                                  : 'bg-amber-50/60 hover:bg-amber-100 text-slate-800 border border-amber-200/70'
                              }`}
                            >
                              <span className={`text-[10px] font-black uppercase ${isActive ? 'text-amber-100' : 'text-amber-700'}`}>
                                {fIdx + 1}. {f.order}
                              </span>
                              <span className="text-2xl font-black my-0.5">{f.symbol}</span>
                              <span className={`text-[10px] truncate max-w-full font-medium ${isActive ? 'text-amber-100' : 'text-slate-500'}`}>
                                {f.word || f.sound}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Active Form Detail Editor (Tab View) */}
                    {b.viewMode !== 'grid' && (() => {
                      const activeIdx = b.activeFormIndex || 0;
                      const activeForm = b.forms?.[activeIdx] || b.forms?.[0] || {};
                      return (
                        <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-xs space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <span className="text-xs font-black text-amber-900 uppercase tracking-wide">
                              Editing Form #{activeIdx + 1}: {activeForm.order} ({activeForm.sound})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (activeForm.audio_url) {
                                  const a = new Audio(resolveFileUrl(activeForm.audio_url));
                                  a.play().catch(() => speakWord(`${activeForm.symbol}. ${activeForm.word || ''}`));
                                } else {
                                  speakWord(`${activeForm.symbol}. ${activeForm.word || ''}`);
                                }
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                            >
                              <span>🔊</span> Test Pronunciation
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <label className="text-xs font-bold text-amber-900 block mb-1">Fidel Symbol</label>
                              <input
                                type="text"
                                value={activeForm.symbol || ''}
                                onChange={(e) => updateFidelFamilyForm(b.id, activeIdx, 'symbol', e.target.value)}
                                className="w-full text-center text-3xl font-black rounded-lg border border-amber-300 p-2 bg-amber-50/30 text-slate-900"
                              />
                            </div>

                            <div>
                              <label className="text-xs font-bold text-amber-900 block mb-1">Example Word (Spoken)</label>
                              <input
                                type="text"
                                value={activeForm.word || ''}
                                onChange={(e) => updateFidelFamilyForm(b.id, activeIdx, 'word', e.target.value)}
                                placeholder="e.g. ሀገር"
                                className="w-full font-bold rounded-lg border border-amber-300 p-2 bg-white text-sm"
                              />
                              <label className="text-xs font-bold text-amber-900 block mt-2 mb-1">Meaning / Translation</label>
                              <input
                                type="text"
                                value={activeForm.translation || ''}
                                onChange={(e) => updateFidelFamilyForm(b.id, activeIdx, 'translation', e.target.value)}
                                placeholder="e.g. Country / Motherland"
                                className="w-full rounded-lg border border-amber-300 p-2 bg-white text-xs"
                              />
                            </div>

                            <div className="sm:col-span-1">
                              <VoiceAudioControl
                                audioUrl={activeForm.audio_url || ''}
                                onAudioChange={(url) => updateFidelFamilyForm(b.id, activeIdx, 'audio_url', url)}
                                symbol={activeForm.symbol}
                                word={activeForm.word}
                                orderName={`${activeForm.order} (${activeForm.sound})`}
                                fallbackSpeak={() => speakWord(`${activeForm.symbol}. ${activeForm.word || ''}`)}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* All 7 Grid View Mode - Direct Voice Recording / URL for every order (ሀ to ሆ) */}
                    {b.viewMode === 'grid' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-2">
                        {(b.forms || []).map((f, fIdx) => (
                          <div key={f.symbol} className="bg-white rounded-xl p-2.5 border border-amber-200 text-center shadow-xs space-y-1.5 flex flex-col justify-between">
                            <div className="space-y-1">
                              <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded block">
                                {fIdx + 1}. {f.order}
                              </span>
                              <input
                                type="text"
                                value={f.symbol}
                                onChange={(e) => updateFidelFamilyForm(b.id, fIdx, 'symbol', e.target.value)}
                                className="w-full text-center text-2xl font-black rounded border border-amber-300 py-0.5 bg-amber-50/20"
                              />
                              <input
                                type="text"
                                value={f.word}
                                onChange={(e) => updateFidelFamilyForm(b.id, fIdx, 'word', e.target.value)}
                                placeholder="Word"
                                className="w-full text-center text-xs font-bold rounded border border-slate-200 py-1"
                              />
                              <input
                                type="text"
                                value={f.translation}
                                onChange={(e) => updateFidelFamilyForm(b.id, fIdx, 'translation', e.target.value)}
                                placeholder="Meaning"
                                className="w-full text-center text-[10px] rounded border border-slate-200 py-0.5"
                              />
                            </div>

                            {/* Voice Recording / Audio Control for each order */}
                            <div className="pt-1 border-t border-amber-100">
                              <VoiceAudioControl
                                compact={true}
                                audioUrl={f.audio_url || ''}
                                onAudioChange={(url) => updateFidelFamilyForm(b.id, fIdx, 'audio_url', url)}
                                symbol={f.symbol}
                                word={f.word}
                                orderName={`${f.order}`}
                                fallbackSpeak={() => speakWord(`${f.symbol}. ${f.word || ''}`)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Card block */}
                {b.block_type === 'card' && (
                  <div className="space-y-3 bg-amber-50/60 p-4 rounded-xl border border-amber-200">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-amber-900 block">Symbol / Character / Number</label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTargetBlockId(b.id);
                                setFidelPickerOpen(true);
                              }}
                              className="text-[11px] text-amber-700 font-extrabold hover:underline"
                            >
                              ፊደል
                            </button>
                            <span className="text-slate-300">·</span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTargetBlockId(b.id);
                                setEnglishPickerOpen(true);
                              }}
                              className="text-[11px] text-indigo-700 font-extrabold hover:underline"
                            >
                              A-Z
                            </button>
                            <span className="text-slate-300">·</span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTargetBlockId(b.id);
                                setMathPickerOpen(true);
                              }}
                              className="text-[11px] text-emerald-700 font-extrabold hover:underline"
                            >
                              123
                            </button>
                            <span className="text-slate-300">·</span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTargetBlockId(b.id);
                                setSciencePickerOpen(true);
                              }}
                              className="text-[11px] text-purple-700 font-extrabold hover:underline"
                            >
                              GK
                            </button>
                          </div>
                        </div>
                        <input type="text" value={b.symbol || ''} onChange={(e) => updateContentBlock(b.id, 'symbol', e.target.value)}
                          placeholder="e.g. ሀ or 1 or A"
                          className="w-full text-center text-3xl font-black rounded-lg border border-amber-300 p-2 bg-white" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-amber-900 block mb-1">Word / Spoken Text</label>
                        <input type="text" value={b.word || ''} onChange={(e) => updateContentBlock(b.id, 'word', e.target.value)}
                          placeholder="e.g. ሀገር or Apple"
                          className="w-full font-bold rounded-lg border border-amber-300 p-2 bg-white text-sm" />
                        <label className="text-xs font-bold text-amber-900 block mt-2 mb-1">Translation / Meaning</label>
                        <input type="text" value={b.translation || ''} onChange={(e) => updateContentBlock(b.id, 'translation', e.target.value)}
                          placeholder="e.g. Country or ፖም"
                          className="w-full rounded-lg border border-amber-300 p-2 bg-white text-xs" />
                      </div>
                      <div>
                        <VoiceAudioControl
                          audioUrl={b.audio_url || ''}
                          onAudioChange={(url) => updateContentBlock(b.id, 'audio_url', url)}
                          symbol={b.symbol}
                          word={b.word}
                          fallbackSpeak={() => speakWord(`${b.symbol || ''}. ${b.word || ''}`)}
                        />
                      </div>
                    </div>

                    {/* Inline helper: If symbol matches an Amharic Fidel family */}
                    {(() => {
                      const matchedFamily = findFidelFamily(b.symbol);
                      if (!matchedFamily) return null;
                      return (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-amber-200/80 bg-white/70 -mx-4 -mb-4 px-4 py-2.5 rounded-b-xl">
                          <div className="flex items-center gap-1.5 text-xs text-amber-900">
                            <span className="text-base">✨</span>
                            <span>
                              Amharic Fidel Family detected: <strong>{matchedFamily.name}</strong> ({matchedFamily.forms.map(f => f.symbol).join(', ')})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => convertCardToFidelFamily(b.id, matchedFamily)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-black px-3.5 py-1.5 text-xs shadow-xs transition hover:scale-102"
                            title="Convert this single card into a unified 7-form family card"
                          >
                            <span>⚡ Convert to Full {matchedFamily.base} Family Card (7 Forms Unified)</span>
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Text block */}
                {b.block_type === 'text' && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600">Story / Text Instruction</label>
                    <textarea rows={4} value={b.content || ''} onChange={(e) => updateContentBlock(b.id, 'content', e.target.value)}
                      placeholder="Write friendly instructions or a short story for young children..."
                      className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                )}

                {/* Audio block */}
                {b.block_type === 'audio' && (
                  <div className="space-y-3">
                    <VoiceAudioControl
                      audioUrl={b.audio_url || ''}
                      onAudioChange={(url) => updateContentBlock(b.id, 'audio_url', url)}
                      symbol="Audio"
                      word={b.transcript}
                      fallbackSpeak={() => speakWord(b.transcript || b.title || '')}
                    />
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1">Spoken Transcript / Prompt</label>
                      <input type="text" value={b.transcript || ''} onChange={(e) => updateContentBlock(b.id, 'transcript', e.target.value)}
                        placeholder="e.g. Listen and say: ሀ!"
                        className="w-full rounded-lg border border-slate-300 p-2 text-sm" />
                    </div>
                  </div>
                )}

                {/* Video block */}
                {b.block_type === 'video' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1">Video URL (YouTube or Vimeo) *</label>
                      <input type="text" value={b.video_url || ''} onChange={(e) => updateContentBlock(b.id, 'video_url', e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="w-full rounded-lg border border-slate-300 p-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1">Watch Instructions</label>
                      <input type="text" value={b.instructions || ''} onChange={(e) => updateContentBlock(b.id, 'instructions', e.target.value)}
                        placeholder="Watch the song and dance along!"
                        className="w-full rounded-lg border border-slate-300 p-2 text-sm" />
                    </div>
                  </div>
                )}

                {/* Image block */}
                {b.block_type === 'image' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1">Image</label>
                      <input type="text" value={b.file_url || ''} onChange={(e) => updateContentBlock(b.id, 'file_url', e.target.value)}
                        placeholder="Image URL or upload below"
                        className="w-full rounded-lg border border-slate-300 p-2 text-sm mb-2" />
                      <UploadButton accept="image/*" label="Upload Image" onUploaded={(url) => updateContentBlock(b.id, 'file_url', url)} />
                      {b.file_url && <img src={b.file_url} alt="preview" className="mt-2 h-24 w-auto rounded-lg border object-contain" />}
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1">Caption / Description</label>
                      <input type="text" value={b.caption || ''} onChange={(e) => updateContentBlock(b.id, 'caption', e.target.value)}
                        placeholder="Look at this friendly lion!"
                        className="w-full rounded-lg border border-slate-300 p-2 text-sm" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <NavBack to={1} />
            <NavNext to={3} label="Next: Add Practice" />
          </div>
        </div>
      )}

      {/* ── STEP 3: PRACTICE ACTIVITIES ─────────────────────────────────── */}
      {step === 3 && (
        <div className="p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-800">Step 3: Add Practice Activities</h3>
              <p className="text-sm text-slate-500 mt-1">Optional but recommended. Practice is age-appropriate and fun, not an exam.</p>
            </div>
            <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-full">{practiceBlocks.length} Activit{practiceBlocks.length !== 1 ? 'ies' : 'y'}</span>
          </div>

          {/* Practice type picker */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">➕ Add a Practice Activity:</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {PRACTICE_TYPES.map((t) => (
                <button key={t.id} onClick={() => addPracticeBlock(t.id)}
                  className="p-3 rounded-xl bg-white border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 shadow-xs transition text-left">
                  <span className="block text-xl mb-1">{t.icon}</span>
                  <span className="block text-xs font-black text-slate-800 leading-tight">{t.label}</span>
                  <span className="block text-[11px] text-slate-500 mt-1 leading-snug">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {practiceBlocks.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center text-slate-400">
              <p className="text-4xl mb-2">🎮</p>
              <p className="font-semibold">No practice activities yet. Add one above, or skip to preview.</p>
            </div>
          )}

          <div className="space-y-4">
            {practiceBlocks.map((p, idx) => (
              <div key={p.id} className="rounded-2xl border-2 border-emerald-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-emerald-500 text-white text-xs font-black flex items-center justify-center">{idx + 1}</span>
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">{p.activity_type.replace(/_/g, ' ')}</span>
                    <input type="text" value={p.title}
                      onChange={(e) => updatePracticeBlock(p.id, 'title', e.target.value)}
                      placeholder="Activity title..."
                      className="font-bold text-slate-800 text-sm border-b border-dashed border-slate-300 focus:outline-none focus:border-emerald-500 px-1" />
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => movePractice(idx, -1)} disabled={idx === 0} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"><MdArrowUpward /></button>
                    <button onClick={() => movePractice(idx, 1)} disabled={idx === practiceBlocks.length - 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"><MdArrowDownward /></button>
                    <button onClick={() => removePracticeBlock(p.id)} className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50"><MdDelete className="text-lg" /></button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600">Instructions for Child</label>
                  <input type="text" value={p.instructions}
                    onChange={(e) => updatePracticeBlock(p.id, 'instructions', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-sm"
                    placeholder="e.g. Tap the star to count, or match the letter!" />
                </div>

                {/* Counting — only for pure counting, NOT math operations */}
                {p.activity_type === 'counting' && !p.is_math_operation && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-emerald-50/50 p-4 rounded-xl border border-emerald-200">
                    <div>
                      <label className="text-xs font-bold text-emerald-900 block mb-1">Correct Count (Number of items to show)</label>
                      <input type="number" min="1" max="20" value={p.target_count || 1}
                        onChange={(e) => { const v = Number(e.target.value); updatePracticeBlock(p.id, 'target_count', v); updatePracticeBlock(p.id, 'correct_answer', String(v)); }}
                        className="w-full rounded-lg border border-emerald-300 p-2 text-center text-xl font-bold bg-white" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-bold text-emerald-900 block mb-1">Answer Options (comma-separated)</label>
                      <input type="text" value={(p.options || []).join(', ')}
                        onChange={(e) => updatePracticeBlock(p.id, 'options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                        placeholder="1, 2, 3, 4"
                        className="w-full rounded-lg border border-emerald-300 p-2 text-sm font-semibold bg-white" />
                      <p className="text-xs text-emerald-700 mt-1">The correct answer is automatically set to the count above.</p>
                    </div>
                  </div>
                )}

                {/* Matching */}
                {p.activity_type === 'matching' && (
                  <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-3">
                    <p className="text-xs font-bold text-emerald-900">Matching Pairs (Left → Right):</p>
                    {(p.pairs || []).map((pair, pIdx) => (
                      <div key={pIdx} className="flex items-center gap-3">
                        <input type="text" value={pair.left}
                          onChange={(e) => { const np = [...p.pairs]; np[pIdx] = { ...np[pIdx], left: e.target.value }; updatePracticeBlock(p.id, 'pairs', np); }}
                          placeholder="Left (e.g. ሀ)"
                          className="flex-1 rounded-lg border border-emerald-300 p-2 text-sm bg-white font-bold text-center" />
                        <span className="text-emerald-700 font-bold">⇄</span>
                        <input type="text" value={pair.right}
                          onChange={(e) => { const np = [...p.pairs]; np[pIdx] = { ...np[pIdx], right: e.target.value }; updatePracticeBlock(p.id, 'pairs', np); }}
                          placeholder="Right (e.g. ሀብታም)"
                          className="flex-1 rounded-lg border border-emerald-300 p-2 text-sm bg-white font-bold text-center" />
                        <button onClick={() => { const np = p.pairs.filter((_, i) => i !== pIdx); updatePracticeBlock(p.id, 'pairs', np); }}
                          className="text-rose-400 hover:text-rose-600 p-1"><MdDelete /></button>
                      </div>
                    ))}
                    <button onClick={() => updatePracticeBlock(p.id, 'pairs', [...(p.pairs || []), { left: '', right: '' }])}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline flex items-center gap-1">
                      <MdAdd className="text-sm" /> Add another pair
                    </button>
                  </div>
                )}

                {/* Multiple Choice */}
                {p.activity_type === 'multiple_choice' && (
                  <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-3">
                    <div>
                      <label className="text-xs font-bold text-emerald-900 block mb-1">Question Prompt</label>
                      <input type="text" value={p.question || ''} onChange={(e) => updatePracticeBlock(p.id, 'question', e.target.value)}
                        placeholder="e.g. Which letter makes the sound 'Ha'?"
                        className="w-full rounded-lg border border-emerald-300 p-2 text-sm bg-white" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-emerald-900 block">Answer Options (enter each one):</label>
                      {(p.options || ['', '', '', '']).map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center ${opt === p.correct_answer ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                            {String.fromCharCode(65 + oIdx)}
                          </span>
                          <input type="text" value={opt}
                            onChange={(e) => { const opts = [...(p.options || ['', '', '', ''])]; opts[oIdx] = e.target.value; updatePracticeBlock(p.id, 'options', opts); }}
                            placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                            className="flex-1 rounded-lg border border-emerald-300 p-2 text-sm bg-white" />
                          <button onClick={() => updatePracticeBlock(p.id, 'correct_answer', opt)}
                            className={`text-xs px-2 py-1 rounded-lg font-bold border transition ${opt === p.correct_answer ? 'bg-emerald-500 text-white border-emerald-500' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'}`}>
                            {opt === p.correct_answer ? '✓ Correct' : 'Mark Correct'}
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-emerald-700">Click "Mark Correct" next to the right answer.</p>
                  </div>
                )}

                {/* ── Listen & Pick (Generic: letter, animal, number, symbol, color…) ── */}
                {p.activity_type === 'listening' && (
                  <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-200 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-100 pb-2">
                      <p className="text-xs font-bold text-purple-900">🎧 Listen &amp; Pick — works for letters, animals, numbers, colors, symbols…</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold text-purple-700">Quick Presets:</span>
                        <button type="button" onClick={() => {
                          updatePracticeBlock(p.id, 'audio_sound', 'ሀ');
                          updatePracticeBlock(p.id, 'options', ['ሀ', 'ሁ', 'ሂ', 'ሃ']);
                          updatePracticeBlock(p.id, 'correct_answer', 'ሀ');
                          updatePracticeBlock(p.id, 'question', 'Which Fidel did you hear?');
                        }} className="px-2 py-0.5 text-xs font-bold bg-white border border-purple-200 text-purple-700 rounded-md hover:bg-purple-100">
                          🔤 Fidel (ሀ)
                        </button>
                        <button type="button" onClick={() => {
                          updatePracticeBlock(p.id, 'audio_sound', 'Lion');
                          updatePracticeBlock(p.id, 'options', ['Lion 🦁', 'Cat 🐱', 'Dog 🐶', 'Elephant 🐘']);
                          updatePracticeBlock(p.id, 'correct_answer', 'Lion 🦁');
                          updatePracticeBlock(p.id, 'question', 'Which animal did you hear?');
                        }} className="px-2 py-0.5 text-xs font-bold bg-white border border-purple-200 text-purple-700 rounded-md hover:bg-purple-100">
                          🦁 Animals
                        </button>
                        <button type="button" onClick={() => {
                          updatePracticeBlock(p.id, 'audio_sound', 'Plus');
                          updatePracticeBlock(p.id, 'options', ['➕ Plus', '➖ Minus', '✖️ Multiply', '➗ Divide']);
                          updatePracticeBlock(p.id, 'correct_answer', '➕ Plus');
                          updatePracticeBlock(p.id, 'question', 'Which math symbol did you hear?');
                        }} className="px-2 py-0.5 text-xs font-bold bg-white border border-purple-200 text-purple-700 rounded-md hover:bg-purple-100">
                          ➕ Math Symbols
                        </button>
                        <button type="button" onClick={() => {
                          updatePracticeBlock(p.id, 'audio_sound', 'Five');
                          updatePracticeBlock(p.id, 'options', ['3', '4', '5', '6']);
                          updatePracticeBlock(p.id, 'correct_answer', '5');
                          updatePracticeBlock(p.id, 'question', 'Which number did you hear?');
                        }} className="px-2 py-0.5 text-xs font-bold bg-white border border-purple-200 text-purple-700 rounded-md hover:bg-purple-100">
                          🔢 Numbers
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-purple-800 block mb-1">Question / Prompt for Child</label>
                      <input type="text" value={p.question || 'What sound did you hear?'}
                        onChange={(e) => updatePracticeBlock(p.id, 'question', e.target.value)}
                        placeholder="e.g. Which animal did you hear? or What number was spoken?"
                        className="w-full rounded-lg border border-purple-300 p-2 text-sm font-semibold bg-white" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-purple-800 block mb-1">What to Hear (the correct answer — letter, word, number, animal…)</label>
                        <input type="text" value={p.audio_sound || ''}
                          onChange={(e) => updatePracticeBlock(p.id, 'audio_sound', e.target.value)}
                          placeholder="e.g.  ሀ  or  Lion  or  Plus  or  5"
                          className="w-full rounded-lg border border-purple-300 p-2 text-xl font-bold bg-white text-center" />
                        <p className="text-xs text-purple-600 mt-1">If no audio file is recorded, the system will speak this text aloud (TTS).</p>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-purple-800 block mb-1">Audio Recording (optional — record or upload a sound)</label>
                        <VoiceAudioControl
                          audioUrl={p.audio_url || ''}
                          onAudioChange={(url) => updatePracticeBlock(p.id, 'audio_url', url)}
                          symbol={p.audio_sound || ''}
                          orderName="listening"
                          compact={false}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-purple-800 block mb-1">
                        Choice Buttons (comma-separated — can be letters, animals, numbers, colors, emojis…)
                      </label>
                      <input type="text" value={(p.options || []).join(', ')}
                        onChange={(e) => updatePracticeBlock(p.id, 'options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                        placeholder="e.g.  ሀ, ሁ, ሂ, ሃ   or   Lion 🦁, Cat 🐱, Dog 🐶, Elephant 🐘"
                        className="w-full rounded-lg border border-purple-300 p-2 text-sm font-bold bg-white" />
                      <p className="text-xs text-purple-600 mt-1">Enter 2–4 choices separated by commas. The child will tap the one they heard.</p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-purple-800 block mb-1">Correct Answer — tap the right one below:</label>
                      <div className="flex flex-wrap gap-2">
                        {(p.options || []).filter(Boolean).map((opt, oIdx) => (
                          <button key={oIdx} type="button"
                            onClick={() => updatePracticeBlock(p.id, 'correct_answer', opt)}
                            className={`px-4 py-2 rounded-xl text-lg font-black border-2 transition ${opt === p.correct_answer ? 'bg-purple-600 text-white border-purple-600' : 'border-purple-300 text-purple-800 hover:bg-purple-50'}`}>
                            {opt} {opt === p.correct_answer && '✓'}
                          </button>
                        ))}
                      </div>
                      {!p.correct_answer && <p className="text-xs text-rose-600 mt-1">⚠ Tap a choice above to mark the correct answer.</p>}
                    </div>
                  </div>
                )}

                {/* ── Letter / Fidel Tracing — multi-character sequence ── */}
                {p.activity_type === 'letter_tracing' && (
                  <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-200 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-2">
                      <p className="text-xs font-bold text-indigo-900">✏️ Write &amp; Trace — Child traces each character in sequence (e.g. ሀ, ሁ, ሂ...)</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold text-indigo-700">Quick Presets:</span>
                        <button type="button" onClick={() => {
                          updatePracticeBlock(p.id, 'trace_chars', ['ሀ', 'ሁ', 'ሂ', 'ሃ', 'ሄ', 'ህ', 'ሆ']);
                          updatePracticeBlock(p.id, 'trace_char', 'ሀ');
                          updatePracticeBlock(p.id, 'guide_word', 'ሀገር');
                          updatePracticeBlock(p.id, 'guide_sound', 'Ha');
                        }} className="px-2 py-0.5 text-xs font-bold bg-white border border-indigo-200 text-indigo-700 rounded-md hover:bg-indigo-100">
                          🔤 ሀ Family (7)
                        </button>
                        <button type="button" onClick={() => {
                          updatePracticeBlock(p.id, 'trace_chars', ['ለ', 'ሉ', 'ሊ', 'ላ', 'ሌ', 'ል', 'ሎ']);
                          updatePracticeBlock(p.id, 'trace_char', 'ለ');
                          updatePracticeBlock(p.id, 'guide_word', 'ልብ');
                          updatePracticeBlock(p.id, 'guide_sound', 'Le');
                        }} className="px-2 py-0.5 text-xs font-bold bg-white border border-indigo-200 text-indigo-700 rounded-md hover:bg-indigo-100">
                          🔤 ለ Family (7)
                        </button>
                        <button type="button" onClick={() => {
                          updatePracticeBlock(p.id, 'trace_chars', ['A', 'B', 'C', 'D', 'E']);
                          updatePracticeBlock(p.id, 'trace_char', 'A');
                          updatePracticeBlock(p.id, 'guide_word', 'Apple');
                          updatePracticeBlock(p.id, 'guide_sound', 'Ay');
                        }} className="px-2 py-0.5 text-xs font-bold bg-white border border-indigo-200 text-indigo-700 rounded-md hover:bg-indigo-100">
                          🔤 English (A–E)
                        </button>
                        <button type="button" onClick={() => {
                          updatePracticeBlock(p.id, 'trace_chars', ['1', '2', '3', '4', '5']);
                          updatePracticeBlock(p.id, 'trace_char', '1');
                          updatePracticeBlock(p.id, 'guide_word', 'One');
                          updatePracticeBlock(p.id, 'guide_sound', 'One');
                        }} className="px-2 py-0.5 text-xs font-bold bg-white border border-indigo-200 text-indigo-700 rounded-md hover:bg-indigo-100">
                          🔢 Numbers (1–5)
                        </button>
                      </div>
                    </div>

                    {/* Multi-character input */}
                    <div>
                      <label className="text-xs font-bold text-indigo-800 block mb-1">
                        Characters to Trace (comma-separated — e.g. ሀ, ሁ, ሂ, ሃ, ሄ, ህ, ሆ)
                      </label>
                      <input type="text"
                        value={p.trace_chars ? p.trace_chars.join(', ') : (p.trace_char ? p.trace_char : '')}
                        onChange={(e) => {
                          const chars = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                          updatePracticeBlock(p.id, 'trace_chars', chars);
                          updatePracticeBlock(p.id, 'trace_char', chars[0] || '');
                        }}
                        placeholder="ሀ, ሁ, ሂ, ሃ, ሄ, ህ, ሆ   or   A, B, C   or   1, 2, 3"
                        className="w-full rounded-lg border border-indigo-300 p-2 text-xl font-bold bg-white" />
                      <p className="text-xs text-indigo-600 mt-1">
                        Enter one or many characters. For a full Fidel family, paste all 7 (ሀ, ሁ, ሂ, ሃ, ሄ, ህ, ሆ).
                        The child traces each one in order, like flashcard writing drills.
                      </p>
                    </div>

                    {/* Preview of characters */}
                    {(p.trace_chars || [p.trace_char]).filter(Boolean).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {(p.trace_chars || [p.trace_char]).filter(Boolean).map((ch, ci) => (
                          <span key={ci} className="w-12 h-12 rounded-xl border-2 border-indigo-300 bg-white flex items-center justify-center text-2xl font-black text-indigo-800">
                            {ch}
                          </span>
                        ))}
                        <span className="text-xs text-indigo-600 self-center">
                          ({(p.trace_chars || [p.trace_char]).filter(Boolean).length} character{(p.trace_chars || [p.trace_char]).filter(Boolean).length !== 1 ? 's' : ''} in sequence)
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-bold text-indigo-800 block mb-1">Example Word</label>
                        <input type="text" value={p.guide_word || ''}
                          onChange={(e) => updatePracticeBlock(p.id, 'guide_word', e.target.value)}
                          placeholder="ሀገር"
                          className="w-full rounded-lg border border-indigo-300 p-2 text-lg font-bold bg-white" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-indigo-800 block mb-1">Pronunciation / Sound</label>
                        <input type="text" value={p.guide_sound || ''}
                          onChange={(e) => updatePracticeBlock(p.id, 'guide_sound', e.target.value)}
                          placeholder="Ha, Hu, Hi…"
                          className="w-full rounded-lg border border-indigo-300 p-2 text-sm bg-white" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-indigo-800 block mb-1">Audio (optional)</label>
                        <VoiceAudioControl
                          audioUrl={p.audio_url || ''}
                          onAudioChange={(url) => updatePracticeBlock(p.id, 'audio_url', url)}
                          symbol={(p.trace_chars || [p.trace_char])[0] || ''}
                          orderName="tracing"
                          compact={false}
                        />
                      </div>
                    </div>

                    <div className="rounded-xl bg-indigo-100 border border-indigo-200 p-3 text-xs text-indigo-800">
                      <strong>How it works:</strong> The child sees each character as a large watermark on a canvas with school guidelines.
                      They trace it with finger or mouse, tap <em>&quot;Done&quot;</em>, then automatically advance to the next character in the sequence!
                    </div>
                  </div>
                )}

                {/* ── Math Operations (supports +, -, ×, ÷ and multiple questions) ── */}
                {(p.is_math_operation || p.activity_config?.is_math_operation) && p.activity_type === 'counting' && (() => {
                  const problems = p.problems && p.problems.length > 0 ? p.problems : [{
                    id: 'prob-default',
                    operation_a: p.operation_a ?? 3,
                    operation_b: p.operation_b ?? 2,
                    operator: p.operator || '+',
                    item_emoji: p.item_emoji || '🍎',
                    options: p.options || ['4', '5', '6', '7'],
                    correct_answer: p.correct_answer || '5',
                    question: p.question || `What is ${p.operation_a ?? 3} ${p.operator || '+'} ${p.operation_b ?? 2}?`,
                  }];

                  const calcAnswer = (a, op, b) => {
                    if (op === '+') return String(a + b);
                    if (op === '-') return String(Math.max(0, a - b));
                    if (op === '×') return String(a * b);
                    if (op === '÷') return b !== 0 ? String(Math.round(a / b * 10) / 10) : '0';
                    return String(a + b);
                  };

                  const updateProblem = (probIdx, field, val) => {
                    const next = [...problems];
                    const item = { ...next[probIdx], [field]: val };
                    if (field === 'operation_a' || field === 'operation_b' || field === 'operator') {
                      const a = Number(field === 'operation_a' ? val : item.operation_a ?? 3);
                      const b = Number(field === 'operation_b' ? val : item.operation_b ?? 2);
                      const op = field === 'operator' ? val : item.operator || '+';
                      const ans = calcAnswer(a, op, b);
                      item.correct_answer = ans;
                      item.question = `What is ${a} ${op} ${b}?`;
                      // Auto suggest nearby options
                      const numAns = Number(ans);
                      if (!isNaN(numAns)) {
                        item.options = [String(Math.max(0, numAns - 1)), ans, String(numAns + 1), String(numAns + 2)];
                      }
                    }
                    next[probIdx] = item;
                    updatePracticeBlock(p.id, 'problems', next);

                    // Sync primary problem fields for top-level compat
                    if (probIdx === 0) {
                      updatePracticeBlock(p.id, 'operation_a', item.operation_a);
                      updatePracticeBlock(p.id, 'operation_b', item.operation_b);
                      updatePracticeBlock(p.id, 'operator', item.operator);
                      updatePracticeBlock(p.id, 'item_emoji', item.item_emoji);
                      updatePracticeBlock(p.id, 'options', item.options);
                      updatePracticeBlock(p.id, 'correct_answer', item.correct_answer);
                      updatePracticeBlock(p.id, 'question', item.question);
                    }
                  };

                  const addProblem = () => {
                    const newProb = {
                      id: `prob-${Date.now()}`,
                      operation_a: 4,
                      operation_b: 2,
                      operator: '+',
                      item_emoji: '⭐',
                      options: ['5', '6', '7', '8'],
                      correct_answer: '6',
                      question: 'What is 4 + 2?',
                    };
                    const next = [...problems, newProb];
                    updatePracticeBlock(p.id, 'problems', next);
                  };

                  const removeProblem = (probIdx) => {
                    if (problems.length <= 1) return;
                    const next = problems.filter((_, i) => i !== probIdx);
                    updatePracticeBlock(p.id, 'problems', next);
                  };

                  return (
                    <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200 space-y-4">
                      <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                        <p className="text-xs font-bold text-amber-900">
                          ➕ Math Operations — Visual Emoji Math (＋, －, ✕, ÷) · {problems.length} Question{problems.length !== 1 ? 's' : ''}
                        </p>
                        <button
                          type="button"
                          onClick={addProblem}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-black shadow-xs cursor-pointer"
                        >
                          <MdAdd /> Add Another Math Question
                        </button>
                      </div>

                      <div className="space-y-4">
                        {problems.map((prob, probIdx) => (
                          <div key={prob.id || probIdx} className="bg-white rounded-xl p-3.5 border border-amber-200 shadow-xs space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                                Problem #{probIdx + 1}
                              </span>
                              {problems.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeProblem(probIdx)}
                                  className="text-rose-500 hover:text-rose-700 text-xs font-bold p-1 rounded hover:bg-rose-50"
                                >
                                  <MdDelete className="text-base inline" /> Remove
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div>
                                <label className="text-[11px] font-bold text-amber-800 block mb-1">First Number (A)</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={prob.operation_a ?? 3}
                                  onChange={(e) => updateProblem(probIdx, 'operation_a', Number(e.target.value))}
                                  className="w-full rounded-lg border border-amber-300 p-2 text-center text-xl font-black bg-white"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] font-bold text-amber-800 block mb-1">Operator</label>
                                <select
                                  value={prob.operator || '+'}
                                  onChange={(e) => updateProblem(probIdx, 'operator', e.target.value)}
                                  className="w-full rounded-lg border border-amber-300 p-2 text-center text-xl font-black bg-white"
                                >
                                  <option value="+">＋ Add</option>
                                  <option value="-">－ Subtract</option>
                                  <option value="×">✕ Multiply</option>
                                  <option value="÷">÷ Divide</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[11px] font-bold text-amber-800 block mb-1">Second Number (B)</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={prob.operation_b ?? 2}
                                  onChange={(e) => updateProblem(probIdx, 'operation_b', Number(e.target.value))}
                                  className="w-full rounded-lg border border-amber-300 p-2 text-center text-xl font-black bg-white"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] font-bold text-amber-800 block mb-1">Item Emoji</label>
                                <input
                                  type="text"
                                  value={prob.item_emoji || '🍎'}
                                  onChange={(e) => updateProblem(probIdx, 'item_emoji', e.target.value)}
                                  className="w-full rounded-lg border border-amber-300 p-2 text-center text-2xl bg-white"
                                />
                              </div>
                            </div>

                            {/* Live calculation banner */}
                            <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl font-black text-amber-800">{prob.operation_a ?? 3}</span>
                                <span className="text-2xl font-black text-amber-600">{prob.operator || '+'}</span>
                                <span className="text-2xl font-black text-amber-800">{prob.operation_b ?? 2}</span>
                                <span className="text-2xl font-black text-slate-400">=</span>
                                <span className="text-2xl font-black text-emerald-700">{prob.correct_answer || '?'}</span>
                              </div>
                              <span className="text-xs text-amber-700 font-semibold">(auto-calculated answer)</span>
                            </div>

                            {/* Answer Choices */}
                            <div>
                              <label className="text-[11px] font-bold text-amber-800 block mb-1">Answer Choices (comma-separated)</label>
                              <input
                                type="text"
                                value={(prob.options || []).join(', ')}
                                onChange={(e) => updateProblem(probIdx, 'options', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                                placeholder="4, 5, 6, 7"
                                className="w-full rounded-lg border border-amber-300 p-2 text-sm font-semibold bg-white"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Drag and Drop / Ordering */}
                {p.activity_type === 'drag_and_drop' && (
                  <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-3">
                    <p className="text-xs font-bold text-emerald-900">Items to Order — enter each item, then set the correct sequence below.</p>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-emerald-800">Items (the student will arrange these):</label>
                      {(p.items || ['', '']).map((item, iIdx) => (
                        <div key={iIdx} className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-500 w-5">{iIdx + 1}.</span>
                          <input type="text" value={item}
                            onChange={(e) => { const it = [...(p.items || [])]; it[iIdx] = e.target.value; updatePracticeBlock(p.id, 'items', it); }}
                            placeholder={`Item ${iIdx + 1} (e.g. ሀ or Monday)`}
                            className="flex-1 rounded-lg border border-emerald-300 p-2 text-sm bg-white font-bold" />
                          {(p.items || []).length > 2 && (
                            <button onClick={() => { const it = p.items.filter((_, i) => i !== iIdx); updatePracticeBlock(p.id, 'items', it); }}
                              className="text-rose-400 hover:text-rose-600 p-1"><MdDelete /></button>
                          )}
                        </div>
                      ))}
                      <button onClick={() => updatePracticeBlock(p.id, 'items', [...(p.items || []), ''])}
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline flex items-center gap-1">
                        <MdAdd className="text-sm" /> Add another item
                      </button>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-emerald-800 block mb-1">Correct Order (comma-separated, e.g. ሀ, ለ, ሐ):</label>
                      <input type="text" value={(p.correct_order || []).join(', ')}
                        onChange={(e) => updatePracticeBlock(p.id, 'correct_order', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                        placeholder="ሀ, ለ, ሐ, መ"
                        className="w-full rounded-lg border border-emerald-300 p-2 text-sm bg-white" />
                      <p className="text-xs text-emerald-700 mt-1">List the items in the correct sequence.</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <NavBack to={2} />
            <NavNext to={4} label="Next: Live Child Preview" />
          </div>
        </div>
      )}

      {/* ── STEP 4: PREVIEW ─────────────────────────────────────────────── */}
      {step === 4 && (
        <div className="p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-800">Step 4: Live Child Preview</h3>
              <p className="text-sm text-slate-500 mt-1">See the lesson exactly as the child will experience it.</p>
            </div>
            <span className="bg-amber-100 text-amber-900 px-3 py-1 rounded-full text-xs font-black">Interactive Test Mode</span>
          </div>

          {contentBlocks.length === 0 && practiceBlocks.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center text-slate-400">
              <p className="text-4xl mb-2">🎨</p>
              <p className="font-semibold">No content yet. Go back to Step 2 to add learning blocks.</p>
            </div>
          ) : (
            <div className="rounded-3xl border-4 border-amber-300 shadow-2xl overflow-hidden bg-slate-900/5 p-4">
              <BasicChildLessonExperience
                lesson={{
                  id: 'preview',
                  title: info.title || 'Untitled Lesson',
                  description: info.description || '',
                  learning_objectives: info.learning_objectives || '',
                  course_title: selectedCourse?.course_title || 'Preview',
                }}
                resources={buildPreviewResources()}
                progress={{ progress_percentage: 0 }}
                onResourceCompleted={() => {}}
                onFinishLesson={() => alert('Child completed the entire lesson preview! 🎉')}
              />
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <NavBack to={3} label="Back to Practice" />
            <NavNext to={5} label="Looks Great: Save & Publish" />
          </div>
        </div>
      )}

      {/* ── STEP 5: SAVE & PUBLISH ──────────────────────────────────────── */}
      {step === 5 && (
        <div className="p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-xl font-black text-slate-800">Step 5: Save & Publish</h3>
            <p className="text-sm text-slate-500 mt-1">Everything will be saved to the database and linked to the child portal.</p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-4">
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-700">Lesson Summary</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              {[
                { label: 'Content Blocks', value: contentBlocks.length, color: 'orange' },
                { label: 'Practice Activities', value: practiceBlocks.length, color: 'emerald' },
                { label: 'Duration', value: `${info.estimated_duration_minutes}m`, color: 'indigo' },
                { label: 'Total Steps', value: contentBlocks.length + practiceBlocks.length, color: 'amber' },
              ].map((s) => (
                <div key={s.label} className="bg-white p-4 rounded-xl border border-slate-200">
                  <span className={`block text-2xl font-black text-${s.color}-600`}>{s.value}</span>
                  <span className="text-xs font-bold text-slate-500">{s.label}</span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase">Publish Status</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-xl border border-slate-200 flex-1 hover:border-emerald-500">
                  <input type="radio" name="pub_status" checked={status === 'active'} onChange={() => setStatus('active')} className="text-emerald-600" />
                  <div>
                    <span className="block text-sm font-black text-slate-800">Publish Immediately</span>
                    <span className="block text-xs text-slate-500">Visible to assigned children right away</span>
                  </div>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-xl border border-slate-200 flex-1 hover:border-slate-400">
                  <input type="radio" name="pub_status" checked={status === 'inactive'} onChange={() => setStatus('inactive')} className="text-slate-600" />
                  <div>
                    <span className="block text-sm font-black text-slate-800">Save as Draft</span>
                    <span className="block text-xs text-slate-500">Keep hidden from students until ready</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <NavBack to={4} label="Back to Preview" />
            <button onClick={handleSaveAndPublish} disabled={saving}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-base rounded-xl shadow-lg hover:scale-105 transition disabled:opacity-50">
              <MdSave className="text-xl" />
              <span>{saving ? 'Saving to Database…' : status === 'active' ? 'Publish Lesson Now' : 'Save as Draft'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Fidel Family Picker Modal ── */}
      {fidelPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black flex items-center gap-2">
                  <span>✨</span> Amharic Fidel Family Studio (የአማርኛ ፊደላት)
                </h3>
                <p className="text-xs text-amber-100 mt-0.5">
                  Select a base Fidel to preview and insert its complete 7-form family into your lesson.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFidelPickerOpen(false)}
                className="p-2 rounded-full hover:bg-white/20 transition text-white"
              >
                <MdClose className="text-xl" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-2">
                  1. Select Base Fidel (ፊደል ምረጥ):
                </label>
                <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-2xl border border-slate-200 max-h-48 overflow-y-auto">
                  {FIDEL_FAMILIES.map((fam) => {
                    const isSelected = fam.base === selectedFidelBase;
                    return (
                      <button
                        key={fam.base}
                        type="button"
                        onClick={() => setSelectedFidelBase(fam.base)}
                        className={`h-11 w-11 rounded-xl text-lg font-black transition flex items-center justify-center ${
                          isSelected
                            ? 'bg-amber-500 text-white shadow-md scale-105 ring-2 ring-amber-300'
                            : 'bg-white text-slate-800 border border-slate-200 hover:border-amber-400 hover:bg-amber-50'
                        }`}
                      >
                        {fam.base}
                      </button>
                    );
                  })}
                </div>
              </div>

              {(() => {
                const currentFam = FIDEL_FAMILIES.find((f) => f.base === selectedFidelBase) || FIDEL_FAMILIES[0];
                return (
                  <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 pb-3">
                      <div>
                        <h4 className="text-base font-black text-amber-950 flex items-center gap-2">
                          <span className="text-2xl font-black text-amber-600 bg-white px-3 py-1 rounded-xl border border-amber-200">
                            {currentFam.base}
                          </span>
                          <span>የ{currentFam.base} ቤተሰብ — {currentFam.name}</span>
                        </h4>
                        <p className="text-xs text-amber-800 mt-1">
                          Consists of 7 phonetic forms: {currentFam.forms.map((f) => f.symbol).join(', ')}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => insertFidelFamilyBlocks(currentFam)}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-5 py-2.5 text-sm font-black shadow-md hover:scale-102 transition"
                      >
                        <span>⚡</span>
                        <span>Insert '{currentFam.base}' Family (7 Forms Unified in 1 Card)</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
                      {currentFam.forms.map((f, i) => (
                        <div
                          key={f.symbol}
                          className="bg-white rounded-xl p-3 border border-amber-200 text-center shadow-xs flex flex-col justify-between"
                        >
                          <div>
                            <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                              {i + 1}. {f.order}
                            </span>
                            <div className="text-3xl font-black text-slate-800 my-2">{f.symbol}</div>
                            <div className="text-[11px] font-semibold text-slate-500">[{f.sound}]</div>
                            <div className="mt-1 text-xs font-bold text-amber-900 truncate" title={f.word}>
                              {f.word}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate" title={f.translation}>
                              {f.translation}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => insertSingleFidelCard(f, currentFam)}
                            className="mt-2 w-full text-[10px] font-bold py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg transition"
                          >
                            + Single Form
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── English Alphabet Picker Modal ── */}
      {englishPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black flex items-center gap-2">
                  <span>🔤</span> English Alphabet Cards (A–Z)
                </h3>
                <p className="text-xs text-indigo-100 mt-0.5">
                  Click any letter to insert a learning card with symbol, word, and translation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnglishPickerOpen(false)}
                className="p-2 rounded-full hover:bg-white/20 transition text-white"
              >
                <MdClose className="text-xl" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 max-h-[60vh] overflow-y-auto p-1">
                {ENGLISH_ALPHABET.map((item) => (
                  <button
                    key={item.letter}
                    type="button"
                    onClick={() => insertEnglishLetterCard(item)}
                    className="p-3 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-400 rounded-2xl text-center group transition shadow-xs"
                  >
                    <div className="text-2xl font-black text-indigo-600 group-hover:scale-110 transition">
                      {item.letter}
                    </div>
                    <div className="text-xs font-bold text-slate-800 mt-1 truncate">{item.word}</div>
                    <div className="text-[10px] text-slate-500 truncate">{item.translation}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Mathematics & Number Studio Modal ── */}
      {mathPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black flex items-center gap-2">
                  <span>🔢</span> Mathematics & Number Studio (የሂሳብና ቁጥሮች ማዕከል)
                </h3>
                <p className="text-xs text-emerald-100 mt-0.5">
                  Pick numbers (0–20), counting dots, geometric shapes, or math symbols to add to your lesson.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMathPickerOpen(false)}
                className="p-2 rounded-full hover:bg-white/20 transition text-white"
              >
                <MdClose className="text-xl" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Category tabs */}
              <div className="flex gap-2 border-b border-slate-200 pb-3">
                <button
                  type="button"
                  onClick={() => setMathTab('numbers')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                    mathTab === 'numbers'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  1️⃣ Numbers 0–20
                </button>
                <button
                  type="button"
                  onClick={() => setMathTab('shapes')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                    mathTab === 'shapes'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  🔺 Shapes & Geometry
                </button>
                <button
                  type="button"
                  onClick={() => setMathTab('operations')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                    mathTab === 'operations'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  ➕ Operations (+, −, =, ×, ÷)
                </button>
              </div>

              {/* Numbers tab */}
              {mathTab === 'numbers' && (
                <div className="space-y-4">
                  {/* Quick batch insert */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs">
                    <span className="font-bold text-emerald-950">Quick Batch Sequence:</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => insertNumberSequence(5)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition shadow-2xs"
                      >
                        ⚡ Insert 1 to 5 (5 Cards)
                      </button>
                      <button
                        type="button"
                        onClick={() => insertNumberSequence(10)}
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg transition shadow-2xs"
                      >
                        ⚡ Insert 1 to 10 (10 Cards)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 max-h-[50vh] overflow-y-auto p-1">
                    {MATH_NUMBERS.map((item) => (
                      <button
                        key={item.symbol}
                        type="button"
                        onClick={() => insertMathCard(item)}
                        className="p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-400 rounded-2xl text-center group transition shadow-xs flex flex-col justify-between"
                      >
                        <div className="text-3xl font-black text-emerald-700 group-hover:scale-110 transition">
                          {item.symbol}
                        </div>
                        <div className="text-xs font-bold text-slate-800 mt-1">{item.word}</div>
                        <div className="text-[10px] text-emerald-800 font-semibold">{item.amharic}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{item.dots}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Shapes tab */}
              {mathTab === 'shapes' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[50vh] overflow-y-auto p-1">
                  {MATH_SHAPES.map((item) => (
                    <button
                      key={item.word}
                      type="button"
                      onClick={() => insertMathCard(item)}
                      className="p-4 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-400 rounded-2xl text-center group transition shadow-xs space-y-1.5"
                    >
                      <div className="text-4xl group-hover:scale-115 transition drop-shadow-2xs">{item.symbol}</div>
                      <div className="text-sm font-black text-slate-900">{item.word}</div>
                      <div className="text-xs font-bold text-emerald-800">{item.amharic}</div>
                      <div className="text-[10px] text-slate-500 leading-tight">{item.desc}</div>
                    </button>
                  ))}
                </div>
              )}

              {/* Operations tab */}
              {mathTab === 'operations' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[50vh] overflow-y-auto p-1">
                  {MATH_OPERATIONS.map((item) => (
                    <button
                      key={item.word}
                      type="button"
                      onClick={() => insertMathCard(item)}
                      className="p-4 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-400 rounded-2xl text-center group transition shadow-xs space-y-1.5"
                    >
                      <div className="text-3xl font-black text-emerald-600 group-hover:scale-110 transition">{item.symbol}</div>
                      <div className="text-xs font-black text-slate-900">{item.word}</div>
                      <div className="text-[11px] font-bold text-emerald-800">{item.amharic}</div>
                      <div className="text-[10px] text-slate-500 leading-tight">{item.desc}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Science & General Knowledge Studio Modal ── */}
      {sciencePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black flex items-center gap-2">
                  <span>🌍</span> Science & General Knowledge Studio (አካባቢ ሳይንስና አጠቃላይ እውቀት)
                </h3>
                <p className="text-xs text-purple-100 mt-0.5">
                  Pick colors, animals, human body parts, or everyday objects to add rich visual cards.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSciencePickerOpen(false)}
                className="p-2 rounded-full hover:bg-white/20 transition text-white"
              >
                <MdClose className="text-xl" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Category tabs */}
              <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                <button
                  type="button"
                  onClick={() => setScienceTab('colors')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                    scienceTab === 'colors'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  🎨 Colors (ቀለማት)
                </button>
                <button
                  type="button"
                  onClick={() => setScienceTab('animals')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                    scienceTab === 'animals'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  🦁 Animals (እንስሳት)
                </button>
                <button
                  type="button"
                  onClick={() => setScienceTab('body')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                    scienceTab === 'body'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  👁️ Body Parts (የሰውነት ክፍሎች)
                </button>
                <button
                  type="button"
                  onClick={() => setScienceTab('nature')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                    scienceTab === 'nature'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  🍎 Nature & Objects (ፍራፍሬዎችና ተፈጥሮ)
                </button>
              </div>

              {/* Items grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[55vh] overflow-y-auto p-1">
                {(scienceTab === 'colors'
                  ? SCIENCE_COLORS
                  : scienceTab === 'animals'
                  ? SCIENCE_ANIMALS
                  : scienceTab === 'body'
                  ? SCIENCE_BODY_PARTS
                  : SCIENCE_NATURE_FOOD
                ).map((item) => (
                  <button
                    key={item.word}
                    type="button"
                    onClick={() => insertScienceCard(item)}
                    className="p-3.5 bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-400 rounded-2xl text-center group transition shadow-xs space-y-1"
                  >
                    <div className="text-3xl group-hover:scale-115 transition">{item.symbol}</div>
                    <div className="text-xs font-black text-slate-900">{item.word}</div>
                    <div className="text-[11px] font-bold text-purple-700">{item.amharic}</div>
                    <div className="text-[10px] text-slate-400 leading-tight line-clamp-2">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
