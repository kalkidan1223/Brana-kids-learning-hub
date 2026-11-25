import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MdVolumeUp, MdReplay, MdArrowBack, MdArrowForward,
  MdCheckCircle, MdStars, MdPlayArrow, MdPause, MdFullscreen
} from 'react-icons/md';
import { resolveFileUrl } from '../../utils/fileUrl';
import useVoiceGuide from '../../hooks/useVoiceGuide';
import axiosClient from '../../api/axiosClient';

export default function BasicChildLessonExperience({
  lesson,
  resources = [],
  progress,
  onResourceCompleted,
  onFinishLesson,
}) {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [celebrating, setCelebrating] = useState(false);
  const [activityAnswer, setActivityAnswer] = useState(null);
  const [activityFeedback, setActivityFeedback] = useState(null); // { correct: boolean, message: string }
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [sessionXp, setSessionXp] = useState(50);
  const [starBurst, setStarBurst] = useState(false);
  const audioRef = useRef(null);
  const voice = useVoiceGuide({ lang: 'am' });

  // Dynamic step icon resolver (based on instructor-posted content type)
  const getStepIcon = (res) => {
    if (!res) return '⭐';
    if (res.resource_type === 'video') return '🎬';
    if (res.resource_type === 'quiz') return '❓';
    if (res.resource_type === 'activity') {
      const at = res.content?.activity_type;
      if (at === 'letter_tracing' || at === 'writing') return '✏️';
      if (at === 'listening') return '🎧';
      if (res.content?.activity_config?.is_math_operation || at === 'math_operation') return '➕';
      if (at === 'counting') return '🔢';
      if (at === 'matching') return '🔗';
      if (at === 'drag_and_drop') return '📋';
      return '🎮';
    }
    if (res.resource_type === 'material') {
      if (res.content?.material_type === 'audio') return '🔊';
      if (res.content?.material_type === 'image') return '🖼️';
      if (res.content?.metadata?.card_type || res.content?.metadata?.symbol) return '🎴';
      return '📖';
    }
    return '⭐';
  };

  // Dynamic mascot cheer based on current step and progress
  const getMascotCheer = () => {
    if (resources.length === 0) return 'Learning area ready! 🎨';
    if (isLastStep) return '🏆 Final step! You are about to finish the lesson!';
    if (currentResource?.resource_type === 'activity') return '🎮 Practice time! You’ve got this!';
    if (currentIndex === 0) return '🚀 Let’s start this exciting learning quest!';
    const pct = Math.round(((currentIndex + 1) / resources.length) * 100);
    if (pct >= 50) return '⭐ Halfway there! Keep shining!';
    return '✨ Great job! Keep learning!';
  };

  // Initialize completed steps from resources
  useEffect(() => {
    const completed = new Set();
    resources.forEach((r, idx) => {
      if (r.status === 'completed' || r.progress_percentage >= 100) {
        completed.add(idx);
      }
    });
    setCompletedSteps(completed);

    // If starting on a specific step
    const firstIncomplete = resources.findIndex(
      (r) => r.status !== 'completed' && (r.progress_percentage || 0) < 100
    );
    if (firstIncomplete !== -1) {
      setCurrentIndex(firstIncomplete);
    }
  }, [resources]);

  const currentResource = resources[currentIndex] || null;
  const isLastStep = currentIndex === resources.length - 1;
  const currentStepCompleted = completedSteps.has(currentIndex);

  // Play audio or speak text
  const speakCurrent = (textToSpeak) => {
    if (textToSpeak) {
      voice.speak(textToSpeak, {
        force: true,
        lang: /[\u1200-\u137F]/.test(textToSpeak) ? 'am' : 'en',
      });
    }
  };

  const markStepDone = async (indexToMark = currentIndex) => {
    if (!completedSteps.has(indexToMark)) {
      setSessionXp((prev) => prev + 10);
      setStarBurst(true);
      setTimeout(() => setStarBurst(false), 1400);
      playSoundEffect('success');
    }
    setCompletedSteps((prev) => new Set([...prev, indexToMark]));
    const res = resources[indexToMark];
    if (res && onResourceCompleted) {
      onResourceCompleted(res.id);
    }

    // Call backend progress if material or video
    if (res && res.resource_type === 'material') {
      try {
        await axiosClient.post(`/child/learning/progress/material/${res.resource_id}`, {
          view_percentage: 100,
        });
      } catch (err) {
        // silent
      }
    }
  };

  const handleNext = () => {
    // If not marked done yet, mark it done as child moves forward
    markStepDone(currentIndex);

    if (isLastStep) {
      setCelebrating(true);
      if (onFinishLesson) onFinishLesson();
    } else {
      setActivityAnswer(null);
      setActivityFeedback(null);
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setActivityAnswer(null);
      setActivityFeedback(null);
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Sound effects using Web Audio API
  const playSoundEffect = (type = 'success') => {
    if (typeof window === 'undefined') return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3); // A5
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      } else {
        osc.frequency.setValueAtTime(260, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(180, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      }
    } catch {
      // AudioContext unavailable
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 pb-16 pt-2 animate-fade-in font-sans relative">
      {/* Floating XP Star Burst Animation */}
      {starBurst && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-bounce">
          <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white font-black text-xl px-5 py-2.5 rounded-full shadow-2xl border-2 border-white flex items-center gap-2">
            <span className="text-2xl">⭐</span>
            <span>+10 XP Earned!</span>
            <span className="text-xl">🎉</span>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border-2 border-indigo-100 bg-white/95 p-3.5 shadow-md backdrop-blur-md">
        <Link
          to={`/child/courses/${lesson?.course_id}`}
          className="inline-flex items-center gap-2 rounded-2xl bg-indigo-50 px-3.5 py-2 text-xs sm:text-sm font-black text-indigo-700 transition hover:bg-indigo-100 active:scale-95"
        >
          <MdArrowBack className="text-lg" />
          <span>Course</span>
        </Link>

        {/* Gamified Star XP Badge & Step Counter */}
        <div className="flex items-center gap-2">
          <span className="flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-3.5 text-xs font-black text-white shadow-sm">
            <MdStars className="text-yellow-100 text-base" />
            <span>{sessionXp} XP</span>
          </span>

          <span className="flex h-9 items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-100 px-3 text-xs font-black text-indigo-900">
            <span>
              {currentIndex + 1} / {Math.max(1, resources.length)}
            </span>
          </span>
        </div>

        {/* Listen Button */}
        <button
          onClick={() => {
            const prompt =
              currentResource?.content?.activity_instructions ||
              currentResource?.content?.text_content ||
              currentResource?.description ||
              currentResource?.title;
            speakCurrent(prompt);
          }}
          className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-500 px-3.5 py-2 text-xs sm:text-sm font-black text-white shadow-md transition hover:bg-emerald-600 active:scale-95 cursor-pointer"
          title="Read step aloud"
        >
          <MdVolumeUp className="text-lg" />
          <span>Listen</span>
        </button>
      </header>

      {/* Interactive Stepping-Stones Quest Trail */}
      {resources.length > 1 && (
        <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-amber-50 border-2 border-indigo-100 rounded-3xl p-3 shadow-sm overflow-x-auto">
          <div className="flex items-center justify-between min-w-max gap-2 px-2">
            {resources.map((r, idx) => {
              const isCurrent = idx === currentIndex;
              const isDone = completedSteps.has(idx);
              const icon = getStepIcon(r);

              return (
                <div key={r.id || idx} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      setActivityAnswer(null);
                      setActivityFeedback(null);
                      setCurrentIndex(idx);
                    }}
                    className={`relative w-11 h-11 rounded-2xl flex items-center justify-center text-xl transition-all duration-200 cursor-pointer ${
                      isCurrent
                        ? 'bg-amber-400 text-amber-950 scale-110 shadow-lg ring-4 ring-amber-200 -translate-y-1'
                        : isDone
                        ? 'bg-emerald-500 text-white shadow-md'
                        : 'bg-white border-2 border-indigo-200 text-slate-600 hover:border-indigo-400'
                    }`}
                    title={r.title}
                  >
                    <span>{icon}</span>

                    {/* Mascot marker hopping on active step */}
                    {isCurrent && (
                      <span className="absolute -top-3.5 text-base animate-bounce">
                        🦁
                      </span>
                    )}

                    {/* Completed checkmark */}
                    {isDone && !isCurrent && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-600 text-white rounded-full text-[9px] font-black flex items-center justify-center">
                        ✓
                      </span>
                    )}
                  </button>

                  {/* Trail connector line */}
                  {idx < resources.length - 1 && (
                    <div className={`w-4 sm:w-6 h-1 mx-1 rounded-full ${
                      idx < currentIndex ? 'bg-emerald-400' : 'bg-indigo-200'
                    }`} />
                  )}
                </div>
              );
            })}

            {/* Final Trophy Stone */}
            <div className="flex items-center ml-1">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-2xl border-2 ${
                completedSteps.size >= resources.length
                  ? 'bg-amber-400 text-amber-950 border-amber-300 shadow-lg animate-pulse'
                  : 'bg-white/80 border-dashed border-amber-300 text-amber-600'
              }`}>
                🏆
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mascot Cheer Banner */}
      <div className="flex items-center gap-3 px-3 py-2 bg-white/90 border border-indigo-100 rounded-2xl shadow-xs">
        <span className="text-2xl animate-bounce">🦁</span>
        <p className="text-xs sm:text-sm font-black text-indigo-900 flex-1">
          {getMascotCheer()}
        </p>
        <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
          {Math.round(((completedSteps.size + (currentStepCompleted ? 1 : 0)) / Math.max(1, resources.length)) * 100)}% Done
        </span>
      </div>

      {/* Main Interactive Stage */}
      <main className="min-h-[460px] rounded-[2.5rem] border-4 border-indigo-200 bg-white p-6 shadow-2xl sm:p-10 flex flex-col justify-between relative overflow-hidden">
        {/* Background glow decoration */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-100/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-emerald-100/60 blur-3xl" />

        {resources.length === 0 ? (
          <div className="my-auto text-center space-y-4 py-16">
            <span className="text-7xl block animate-bounce">🎨</span>
            <h2 className="text-2xl font-black text-slate-800">Learning Area Ready!</h2>
            <p className="text-slate-500 max-w-md mx-auto font-medium">
              Your instructor is preparing joyful learning cards and activities for this lesson. Check back very soon!
            </p>
          </div>
        ) : (
          <div className="relative z-10 space-y-6">
            {/* Step Header */}
            <div className="text-center space-y-1">
              <span className="inline-block rounded-full bg-indigo-50 px-4 py-1 text-xs font-black uppercase tracking-wider text-indigo-700">
                {currentResource?.resource_type === 'material'
                  ? currentResource?.content?.material_type === 'audio'
                    ? 'Audio & Pronunciation'
                    : currentResource?.content?.metadata?.card_type
                    ? 'Learning Card'
                    : 'Read & Discover'
                  : currentResource?.resource_type === 'video'
                  ? 'Video Demonstration'
                  : currentResource?.resource_type === 'activity'
                  ? 'Interactive Practice'
                  : 'Quiz & Review'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {currentResource?.title}
              </h2>
              {currentResource?.description && (
                <p className="text-sm font-semibold text-slate-600 max-w-xl mx-auto">
                  {currentResource.description}
                </p>
              )}
            </div>

            {/* Content Renderer by Resource Type */}
            <div className="pt-2">
              {/* 1. LEARNING CARD (Character, Number, Vocabulary, or Picture Card) */}
              {currentResource?.content?.metadata?.card_type ||
              currentResource?.content?.metadata?.symbol ||
              currentResource?.content?.metadata?.number ||
              currentResource?.content?.metadata?.word ? (
                <LearningCardStage
                  card={currentResource.content.metadata}
                  content={currentResource.content}
                  speakCurrent={speakCurrent}
                  onDone={() => markStepDone(currentIndex)}
                />
              ) : currentResource?.resource_type === 'material' ? (
                <MaterialStage
                  resource={currentResource}
                  speakCurrent={speakCurrent}
                  onDone={() => markStepDone(currentIndex)}
                />
              ) : currentResource?.resource_type === 'video' ? (
                <VideoStage
                  resource={currentResource}
                  onDone={() => markStepDone(currentIndex)}
                />
              ) : currentResource?.resource_type === 'activity' ? (
                <ActivityStage
                  resource={currentResource}
                  allResources={resources}
                  activityAnswer={activityAnswer}
                  setActivityAnswer={setActivityAnswer}
                  activityFeedback={activityFeedback}
                  setActivityFeedback={setActivityFeedback}
                  playSoundEffect={playSoundEffect}
                  onDone={() => markStepDone(currentIndex)}
                />
              ) : currentResource?.resource_type === 'quiz' ? (
                <QuizStage
                  resource={currentResource}
                  playSoundEffect={playSoundEffect}
                  onDone={() => markStepDone(currentIndex)}
                />
              ) : (
                <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-8 text-center text-slate-600 font-medium">
                  {currentResource?.title}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom Navigation */}
        <footer className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between gap-4 relative z-10">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="inline-flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            <MdArrowBack className="text-lg" />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-2">
            {currentStepCompleted && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                <MdCheckCircle className="text-emerald-600 text-sm" /> Step Finished!
              </span>
            )}
          </div>

          <button
            onClick={handleNext}
            className={`inline-flex items-center gap-2 rounded-2xl px-7 py-3 text-sm font-black text-white shadow-lg transition active:scale-95 ${
              isLastStep
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-200'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-200'
            }`}
          >
            <span>{isLastStep ? 'Finish Lesson 🎉' : 'Next Step'}</span>
            {!isLastStep && <MdArrowForward className="text-lg" />}
          </button>
        </footer>
      </main>

      {/* Completion Modal - Gamified Collectible Sticker Stamp */}
      {celebrating && (() => {
        const titleLower = `${lesson?.title || ''} ${lesson?.course_title || ''}`.toLowerCase();
        let badgeIcon = '🌟';
        let badgeName = 'Super Learner Stamp!';
        let badgeSubtitle = 'ጎበዝ ተማሪ!';

        if (titleLower.includes('amh') || titleLower.includes('fidel') || titleLower.includes('ፊደል')) {
          badgeIcon = '🦁';
          badgeName = 'Fidel Champion Stamp!';
          badgeSubtitle = 'ፊደል አዋቂ!';
        } else if (titleLower.includes('math') || titleLower.includes('ሒሳብ') || titleLower.includes('ቁጥር')) {
          badgeIcon = '🔢';
          badgeName = 'Math Hero Stamp!';
          badgeSubtitle = 'የሂሳብ ጀግና!';
        } else if (titleLower.includes('sci') || titleLower.includes('አካባቢ') || titleLower.includes('science')) {
          badgeIcon = '🔬';
          badgeName = 'Little Scientist Stamp!';
          badgeSubtitle = 'ተመራማሪ!';
        } else if (titleLower.includes('eng')) {
          badgeIcon = '🔤';
          badgeName = 'Word Master Stamp!';
          badgeSubtitle = 'የእንግሊዝኛ ጀግና!';
        }

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md animate-fade-in">
            <div className="w-full max-w-md rounded-[2.5rem] border-4 border-amber-300 bg-white p-8 text-center shadow-2xl space-y-6 relative overflow-hidden">
              {/* Background glow decoration */}
              <div className="absolute -top-12 -right-12 w-36 h-36 bg-amber-300/30 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-indigo-300/30 rounded-full blur-2xl pointer-events-none" />

              {/* Collectible Sticker Stamp Award */}
              <div className="relative mx-auto w-32 h-32 rounded-full bg-gradient-to-tr from-amber-400 via-yellow-300 to-orange-400 p-1.5 shadow-xl animate-bounce">
                <div className="w-full h-full rounded-full border-4 border-dashed border-white/90 bg-gradient-to-br from-amber-500 to-orange-600 flex flex-col items-center justify-center text-white">
                  <span className="text-5xl">{badgeIcon}</span>
                  <span className="text-[10px] font-black uppercase tracking-wider mt-1">Reward Stamp</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-black uppercase text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
                  Lesson Completed!
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
                  {badgeName}
                </h3>
                <p className="text-base font-extrabold text-amber-600">
                  {badgeSubtitle}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-600">
                  You finished all steps in <span className="font-bold text-indigo-700">{lesson?.title}</span>!
                </p>
              </div>

              {/* XP & Mastery counters */}
              <div className="rounded-2xl bg-gradient-to-r from-amber-50 via-white to-orange-50 border-2 border-amber-200 p-4 flex items-center justify-around shadow-inner">
                <div>
                  <span className="block text-2xl font-black text-amber-600">⭐ +{sessionXp}</span>
                  <span className="text-xs font-bold text-amber-900">Total XP</span>
                </div>
                <div className="h-8 w-px bg-amber-200" />
                <div>
                  <span className="block text-2xl font-black text-emerald-600">✓ 100%</span>
                  <span className="text-xs font-bold text-emerald-900">Mastery</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5">
                <Link
                  to={`/child/courses/${lesson?.course_id}`}
                  className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 py-4 text-center text-base font-black text-white shadow-lg transition active:scale-95"
                >
                  Collect Sticker &amp; Back to Course 🚀
                </Link>
                <button
                  onClick={() => {
                    setCelebrating(false);
                    setCurrentIndex(0);
                  }}
                  className="w-full rounded-2xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Review Lesson Again 🔄
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ----------------------------------------------------------------------------
// LEARNING CARD STAGE (Fidel, Number, Vocabulary, or Picture card)
// ----------------------------------------------------------------------------
function LearningCardStage({ card, content, speakCurrent, onDone }) {
  const symbol = card?.symbol || card?.character || card?.number || '';
  const word = card?.word || card?.english || card?.meaning || '';
  const translation = card?.translation || card?.amharic || '';
  const sound = card?.sound || card?.romanized || card?.pronunciation || '';
  const description = card?.description || content?.text_content || '';
  const imageUrl = resolveFileUrl(card?.image_url || card?.file_url || content?.thumbnail_url || (content?.material_type === 'image' ? content?.file_url : null));
  const audioUrl = resolveFileUrl(card?.audio_url || (content?.material_type === 'audio' ? content?.file_url : null));

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const speakCard = () => {
    let toSpeak = '';
    if (symbol && word) {
      toSpeak = `${symbol}. ${word}`;
    } else if (symbol) {
      toSpeak = sound ? `${symbol}. ${sound}` : symbol;
    } else if (word) {
      toSpeak = word;
    } else if (sound) {
      toSpeak = sound;
    } else if (translation) {
      toSpeak = translation;
    } else {
      toSpeak = description || 'Card';
    }

    if (toSpeak) {
      speakCurrent(toSpeak);
    }
  };

  const handleHear = () => {
    setIsPlayingAudio(true);
    setTimeout(() => setIsPlayingAudio(false), 1200);

    // 1. Try uploaded / recorded / linked audio file first
    if (audioUrl) {
      try {
        const a = new Audio(audioUrl);
        a.play()
          .then(() => {
            if (onDone) onDone();
          })
          .catch((err) => {
            console.warn('Audio playback failed, using fallback TTS:', err);
            speakCard();
            if (onDone) onDone();
          });
        return;
      } catch (err) {
        console.warn('Audio initialization error:', err);
      }
    }

    // 2. Fallback to speech synthesis
    speakCard();
    if (onDone) onDone();
  };

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-4">
      {/* Visual Card */}
      <div className="group relative flex w-full max-w-sm flex-col items-center justify-center rounded-3xl border-4 border-indigo-200 bg-gradient-to-b from-indigo-50/50 via-white to-purple-50/40 p-8 text-center shadow-xl transition hover:border-indigo-300">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={symbol || word || 'Learning item'}
            className="mb-4 h-36 w-36 object-contain rounded-2xl shadow-sm"
          />
        )}

        {symbol && (
          <span className="text-7xl sm:text-8xl font-black text-indigo-900 tracking-wider drop-shadow-sm select-none">
            {symbol}
          </span>
        )}

        {word && (
          <span className="mt-2 text-2xl font-black text-indigo-700 capitalize tracking-wide">
            {word}
          </span>
        )}

        {sound && !word && (
          <span className="mt-2 text-xl font-black text-indigo-600 uppercase tracking-widest">
            {sound}
          </span>
        )}

        {(translation || description) && (
          <div className="mt-3 rounded-xl bg-white/80 px-4 py-1.5 border border-slate-200 text-sm font-bold text-slate-700">
            {translation && <span className="font-black text-slate-900 mr-2">{translation}</span>}
            {description && <span className="text-slate-500 font-medium">{description}</span>}
          </div>
        )}

        {/* Large audio trigger */}
        <button
          type="button"
          onClick={handleHear}
          className={`mt-6 flex items-center gap-2 rounded-2xl px-6 py-3 font-black text-white shadow-lg transition active:scale-95 cursor-pointer ${
            isPlayingAudio ? 'bg-emerald-600 scale-105' : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          <MdVolumeUp className="text-2xl" />
          <span>{isPlayingAudio ? 'Speaking...' : 'Say It!'}</span>
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// MATERIAL STAGE (Text, PDF, Document, Audio)
// ----------------------------------------------------------------------------
function MaterialStage({ resource, speakCurrent, onDone }) {
  const content = resource.content || {};
  const matType = content.material_type || 'other';
  const fileUrl = resolveFileUrl(content.file_url);
  const textContent = content.text_content || resource.description;

  return (
    <div className="space-y-6">
      {/* Audio player */}
      {matType === 'audio' ? (
        <div className="mx-auto max-w-md rounded-3xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-8 text-center shadow-md space-y-4">
          <span className="text-6xl block animate-bounce">🎧</span>
          <p className="text-sm font-bold text-emerald-800">Tap below to listen and practice pronunciation!</p>
          {fileUrl ? (
            <audio
              controls
              src={fileUrl}
              className="w-full rounded-2xl shadow-sm"
              onEnded={onDone}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                speakCurrent(textContent || resource.title);
                if (onDone) onDone();
              }}
              className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white shadow-md hover:bg-emerald-700 active:scale-95 cursor-pointer"
            >
              🔊 Play Voice Guide
            </button>
          )}
        </div>
      ) : matType === 'image' || fileUrl?.match(/\.(png|jpe?g|webp|gif|svg)$/i) ? (
        <div className="flex flex-col items-center justify-center space-y-4">
          <img
            src={fileUrl}
            alt={resource.title}
            className="max-h-80 w-auto rounded-3xl border-4 border-slate-100 object-contain shadow-lg"
          />
          {textContent && (
            <div className="flex flex-col items-center gap-2">
              <p className="max-w-xl text-center text-base font-bold text-slate-700">{textContent}</p>
              <button
                type="button"
                onClick={() => speakCurrent(textContent)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                🔊 Read Text
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Rich Text / Instruction / Explanation */
        <div className="mx-auto max-w-2xl rounded-3xl border-2 border-indigo-100 bg-indigo-50/40 p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between gap-3 border-b border-indigo-100 pb-3">
            <h3 className="text-sm font-black text-indigo-900">{resource.title}</h3>
            {(textContent || resource.description) && (
              <button
                type="button"
                onClick={() => speakCurrent(textContent || resource.description)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 active:scale-95 cursor-pointer"
              >
                🔊 Read Aloud
              </button>
            )}
          </div>
          <div className="prose prose-indigo max-w-none text-base sm:text-lg font-medium leading-relaxed text-slate-800 whitespace-pre-line">
            {textContent || resource.description}
          </div>
          {fileUrl && (
            <div className="pt-2">
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-indigo-700"
              >
                Open Attached Document 📄
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// VIDEO STAGE (YouTube or Uploaded video)
// ----------------------------------------------------------------------------
function VideoStage({ resource, onDone }) {
  const content = resource.content || {};
  const videoUrl = content.video_url || '';
  const fileUrl = resolveFileUrl(videoUrl);

  const ytMatch = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  const ytId = ytMatch ? ytMatch[1] : null;

  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-3xl border-4 border-slate-200 bg-black aspect-video shadow-2xl relative">
      {ytId ? (
        <iframe
          src={`https://www.youtube.com/embed/${ytId}?rel=0`}
          title={resource.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full border-0"
        />
      ) : fileUrl ? (
        <video
          controls
          src={fileUrl}
          className="h-full w-full"
          onEnded={onDone}
        >
          Your browser does not support the video tag.
        </video>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-white font-bold text-sm">
          Video source not configured
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// ACTIVITY STAGE (Interactive Exercise: Matching, MCQ, Counting, Drag&Drop)
// ----------------------------------------------------------------------------
function ActivityStage({
  resource,
  allResources = [],
  activityAnswer,
  setActivityAnswer,
  activityFeedback,
  setActivityFeedback,
  playSoundEffect,
  onDone,
}) {
  const content = resource.content || {};
  const config = content.activity_config || {};
  const activityType = content.activity_type || 'multiple_choice';
  const instructions = content.instructions || resource.description || 'Answer the exercise!';

  // Helper to extract learning cards from all resources
  const getLessonCardItems = () => {
    return (allResources || [])
      .filter((r) => r.content?.metadata?.symbol)
      .map((r) => ({
        symbol: r.content.metadata.symbol,
        word: r.content.metadata.word || '',
        translation: r.content.metadata.translation || '',
      }));
  };

  // Multiple Choice / True False
  if (activityType === 'multiple_choice' || activityType === 'true_false') {
    const cards = getLessonCardItems();
    const fallbackQuestion = cards.length > 0 ? `Which item represents ${cards[0].word || cards[0].symbol}?` : 'Choose the correct answer:';
    const fallbackOptions = cards.length >= 2 ? cards.slice(0, 4).map(c => c.symbol || c.word) : ['Option A', 'Option B', 'Option C'];

    const question = config.question || config.prompt || resource.title || fallbackQuestion;
    const rawOptions = (config.options || []).filter(o => typeof o === 'string' && o.trim().length > 0);
    const options = rawOptions.length >= 2 ? rawOptions : fallbackOptions;
    const correctAnswer = config.correctAnswer || config.correct_answer || options[0];

    const handleSelectOption = async (option) => {
      setActivityAnswer(option);
      const isCorrect = String(option).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();

      if (isCorrect) {
        playSoundEffect('success');
        setActivityFeedback({ correct: true, message: '🎉 Excellent! That is correct!' });
        if (onDone) onDone();

        try {
          await axiosClient.post(`/child/activities/${resource.resource_id}/submit`, {
            submission_text: String(option),
            score: content.max_score || 100,
            auto_graded: true,
          });
        } catch {
          // silent
        }
      } else {
        playSoundEffect('error');
        setActivityFeedback({ correct: false, message: '🤔 Not quite. Try again!' });
      }
    };

    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div className="rounded-2xl bg-indigo-50/80 p-5 text-center font-bold text-indigo-950 text-lg border border-indigo-100">
          {question}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((option, idx) => {
            const isSelected = activityAnswer === option;
            const isCorrect = activityFeedback?.correct && isSelected;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectOption(option)}
                className={`rounded-2xl border-2 p-4 text-center font-black text-base transition active:scale-95 shadow-sm ${
                  isCorrect
                    ? 'border-emerald-500 bg-emerald-100 text-emerald-950'
                    : isSelected && !activityFeedback?.correct
                    ? 'border-rose-400 bg-rose-50 text-rose-900'
                    : 'border-slate-200 bg-white text-slate-800 hover:border-indigo-300 hover:bg-slate-50'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>

        {activityFeedback && (
          <div
            className={`rounded-2xl p-4 text-center font-black text-sm animate-fade-in ${
              activityFeedback.correct
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                : 'bg-rose-100 text-rose-900 border border-rose-300'
            }`}
          >
            {activityFeedback.message}
          </div>
        )}
      </div>
    );
  }

  // Drag and Drop / Put in Order Activity
  if (activityType === 'drag_and_drop') {
    let rawItems = (config.items || []).filter((s) => typeof s === 'string' && s.trim().length > 0);
    let rawOrder = (config.correct_order || config.correctOrder || []).filter((s) => typeof s === 'string' && s.trim().length > 0);

    // If items were empty, auto-populate from lesson cards!
    if (rawItems.length < 2) {
      const cards = getLessonCardItems();
      if (cards.length >= 2) {
        rawItems = cards.slice(0, 5).map((c) => c.symbol);
        rawOrder = [...rawItems];
      } else {
        rawItems = ['ሀ', 'ሁ', 'ሂ', 'ሃ'];
        rawOrder = ['ሀ', 'ሁ', 'ሂ', 'ሃ'];
      }
    }

    if (rawOrder.length < 2) {
      rawOrder = [...rawItems];
    }

    return (
      <InteractiveOrderingPlayer
        items={rawItems}
        correctOrder={rawOrder}
        activityId={resource.resource_id}
        maxScore={content.max_score || 100}
        playSoundEffect={playSoundEffect}
        onDone={onDone}
      />
    );
  }

  // Matching Activity (e.g. Word to Picture or Letter to Word)
  if (activityType === 'matching') {
    let pairs = (config.pairs || []).filter(
      (p) => (p.left && String(p.left).trim().length > 0) || (p.right && String(p.right).trim().length > 0)
    );

    if (pairs.length === 0) {
      const cards = getLessonCardItems();
      if (cards.length >= 2) {
        pairs = cards.slice(0, 4).map((c) => ({
          left: c.symbol,
          right: c.word || c.translation || c.symbol,
        }));
      } else {
        pairs = [
          { left: 'ሀ', right: 'ሀገር' },
          { left: 'ለ', right: 'ሎሚ' },
          { left: 'መ', right: 'መርከብ' },
        ];
      }
    }

    return (
      <InteractiveMatchingPlayer
        pairs={pairs}
        activityId={resource.resource_id}
        maxScore={content.max_score || 100}
        playSoundEffect={playSoundEffect}
        onDone={onDone}
      />
    );
  }

  // Counting Activity
  if (activityType === 'counting') {
    const targetCount = Number(config.targetCount || config.count || config.target_count || 4);
    const itemEmoji = config.itemEmoji || config.emoji || '🍎';
    const safeCount = targetCount > 0 ? targetCount : 4;
    const rawOptions = (config.options || []).map((o) => Number(o)).filter((n) => !isNaN(n));
    const options = rawOptions.length >= 2 ? rawOptions : [safeCount - 1, safeCount, safeCount + 2, safeCount + 1].sort(
      () => Math.random() - 0.5
    );

    return (
      <InteractiveCountingPlayer
        targetCount={safeCount}
        itemEmoji={itemEmoji}
        options={options}
        activityId={resource.resource_id}
        maxScore={content.max_score || 100}
        playSoundEffect={playSoundEffect}
        onDone={onDone}
      />
    );
  }

  // Letter & Fidel Tracing / Writing Activity
  if (activityType === 'letter_tracing' || activityType === 'number_tracing' || activityType === 'writing') {
    const rawChars = config.trace_chars || (config.trace_char?.includes(',') ? config.trace_char.split(',').map(s => s.trim()).filter(Boolean) : null);
    const traceChars = Array.isArray(rawChars) && rawChars.length > 0
      ? rawChars
      : [config.trace_char || config.character || config.symbol || 'ሀ'];
    const guideWord = config.guide_word || config.word || '';
    const guideSound = config.sound || config.pronunciation || '';

    return (
      <InteractiveTracingPlayer
        traceChars={traceChars}
        traceChar={traceChars[0]}
        guideWord={guideWord}
        guideSound={guideSound}
        instructions={instructions}
        activityId={resource.resource_id}
        maxScore={content.max_score || 100}
        playSoundEffect={playSoundEffect}
        onDone={onDone}
      />
    );
  }

  // Listening & Audio Matching Activity (generic: letters, animals, math, words, symbols)
  if (activityType === 'listening') {
    const audioUrl = config.audio_url || '';
    const audioSound = config.audio_sound || config.sound || config.correct_answer || 'ሀ';
    const rawOptions = (config.options || []).filter((o) => typeof o === 'string' && o.trim().length > 0);
    const options = rawOptions.length >= 2 ? rawOptions : ['ሀ', 'ሁ', 'ሂ', 'ሃ'];
    const correctAnswer = config.correct_answer || config.correctAnswer || options[0];
    const question = config.question || 'What sound did you hear?';

    return (
      <InteractiveAudioPickerPlayer
        audioUrl={audioUrl}
        audioSound={audioSound}
        options={options}
        correctAnswer={correctAnswer}
        question={question}
        instructions={instructions}
        activityId={resource.resource_id}
        maxScore={content.max_score || 100}
        playSoundEffect={playSoundEffect}
        onDone={onDone}
      />
    );
  }

  // Math Operation Activity (supports +, -, ×, ÷ and multiple problems)
  if (config.is_math_operation || activityType === 'math_operation') {
    const rawProblems = Array.isArray(config.problems) && config.problems.length > 0
      ? config.problems
      : [{
          numA: Number(config.operation_a ?? 3),
          numB: Number(config.operation_b ?? 2),
          operator: config.operator || '+',
          question: config.question,
          options: config.options,
          correctAnswer: config.correct_answer,
          itemEmoji: config.item_emoji || '🍎',
        }];

    return (
      <InteractiveMathOperationPlayer
        problems={rawProblems}
        numA={Number(config.operation_a ?? 3)}
        numB={Number(config.operation_b ?? 2)}
        operator={config.operator || '+'}
        question={config.question}
        options={config.options}
        correctAnswer={config.correct_answer}
        itemEmoji={config.item_emoji || '🍎'}
        activityId={resource.resource_id}
        maxScore={content.max_score || 100}
        playSoundEffect={playSoundEffect}
        onDone={onDone}
      />
    );
  }

  // Generic Practice Fallback
  return (
    <div className="mx-auto max-w-lg rounded-3xl border-2 border-indigo-100 bg-indigo-50/50 p-8 text-center space-y-4">
      <span className="text-5xl block animate-bounce">🎯</span>
      <h3 className="text-xl font-black text-slate-900">{resource.title}</h3>
      <p className="text-sm font-semibold text-slate-600 leading-relaxed">{instructions}</p>
      <button
        type="button"
        onClick={() => {
          playSoundEffect('success');
          if (onDone) onDone();
        }}
        className="rounded-2xl bg-indigo-600 px-6 py-3 font-black text-white shadow-md hover:bg-indigo-700 active:scale-95 cursor-pointer"
      >
        ✓ Complete Practice
      </button>
    </div>
  );
}

// ----------------------------------------------------------------------------
// INTERACTIVE ORDERING COMPONENT (Put in Order / Drag & Drop)
// ----------------------------------------------------------------------------
function InteractiveOrderingPlayer({ items = [], correctOrder = [], activityId, maxScore, playSoundEffect, onDone }) {
  const [available, setAvailable] = useState(() => {
    const list = items.map((text, idx) => ({ id: `order-${idx}-${text}`, text }));
    // Shuffle if more than 1 item
    return [...list].sort(() => Math.random() - 0.5);
  });
  const [placed, setPlaced] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);

  const handlePlace = (item) => {
    if (isCompleted) return;
    setFeedback(null);
    const nextPlaced = [...placed, item];
    const nextAvail = available.filter((x) => x.id !== item.id);
    setPlaced(nextPlaced);
    setAvailable(nextAvail);

    if (nextPlaced.length === items.length) {
      const placedTexts = nextPlaced.map((x) => String(x.text).trim().toLowerCase());
      const targetTexts = correctOrder.map((x) => String(x).trim().toLowerCase());
      const isCorrect = placedTexts.every((txt, i) => txt === targetTexts[i]);

      if (isCorrect) {
        playSoundEffect('success');
        setIsCompleted(true);
        setFeedback({
          correct: true,
          message: '🌟 Fantastic! You put everything in perfect order! 🎉',
        });
        if (onDone) onDone();
        try {
          axiosClient.post(`/child/activities/${activityId}/submit`, {
            submission_text: JSON.stringify({ completed: true, order: placedTexts }),
            score: maxScore,
            auto_graded: true,
          });
        } catch {
          // silent
        }
      } else {
        playSoundEffect('error');
        setFeedback({
          correct: false,
          message: '🤔 Not quite in the right order yet. Tap an item in the slot to return it, or click Reset!',
        });
      }
    }
  };

  const handleRemove = (item) => {
    if (isCompleted) return;
    setFeedback(null);
    setPlaced(placed.filter((x) => x.id !== item.id));
    setAvailable([...available, item]);
  };

  const handleReset = () => {
    if (isCompleted) return;
    setPlaced([]);
    setAvailable([...items.map((text, idx) => ({ id: `order-${idx}-${text}`, text }))].sort(() => Math.random() - 0.5));
    setFeedback(null);
  };

  const totalSlots = items.length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center space-y-1">
        <p className="text-base font-black text-slate-800">
          Tap the pieces below in the correct order:
        </p>
        <p className="text-xs font-semibold text-slate-500">
          (Tap a placed piece in any slot if you want to put it back)
        </p>
      </div>

      {/* Target Slots */}
      <div className="bg-amber-50/70 border-2 border-amber-200/90 rounded-3xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {Array.from({ length: totalSlots }).map((_, slotIdx) => {
            const placedItem = placed[slotIdx];
            return (
              <div key={slotIdx} className="flex flex-col items-center">
                <span className="text-[11px] font-black text-amber-800/70 mb-1">
                  #{slotIdx + 1}
                </span>
                {placedItem ? (
                  <button
                    type="button"
                    onClick={() => handleRemove(placedItem)}
                    disabled={isCompleted}
                    className={`h-16 min-w-16 px-4 rounded-2xl font-black text-2xl flex items-center justify-center transition shadow-md active:scale-95 ${
                      isCompleted
                        ? 'bg-emerald-500 text-white border-2 border-emerald-400'
                        : 'bg-white text-indigo-900 border-2 border-indigo-400 hover:border-rose-400 hover:bg-rose-50'
                    }`}
                    title="Tap to remove"
                  >
                    {placedItem.text}
                  </button>
                ) : (
                  <div className="h-16 min-w-16 px-4 rounded-2xl border-2 border-dashed border-amber-300 bg-white/60 flex items-center justify-center text-amber-500 font-bold text-sm">
                    Slot {slotIdx + 1}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Available choices to tap */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Available pieces ({available.length} remaining):
          </span>
          {placed.length > 0 && !isCompleted && (
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 underline"
            >
              ↺ Reset Pieces
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 min-h-24">
          {available.length === 0 && !isCompleted && (
            <span className="text-xs font-bold text-slate-400">All pieces placed! Checking order...</span>
          )}
          {available.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handlePlace(item)}
              disabled={isCompleted}
              className="h-16 min-w-16 px-4 rounded-2xl bg-white border-2 border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/70 text-slate-900 font-black text-2xl shadow-sm transition active:scale-95"
            >
              {item.text}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`rounded-2xl p-4 text-center font-black text-base shadow-sm animate-fade-in ${
            feedback.correct
              ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
              : 'bg-rose-100 text-rose-950 border border-rose-300'
          }`}
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// INTERACTIVE MATCHING COMPONENT
// ----------------------------------------------------------------------------
function InteractiveMatchingPlayer({ pairs = [], activityId, maxScore, playSoundEffect, onDone }) {
  const [selectedLeft, setSelectedLeft] = useState(null);
  const [matched, setMatched] = useState(new Set());
  const [feedback, setFeedback] = useState(null);

  const leftItems = pairs.map((p, idx) => ({ id: idx, text: p.left || p.character || p.source }));
  // Shuffled right column so it's a real puzzle
  const [rightItems] = useState(() => {
    const list = pairs.map((p, idx) => ({ id: idx, text: p.right || p.target || p.word }));
    return [...list].sort(() => Math.random() - 0.5);
  });

  const handleSelectLeft = (id) => {
    if (matched.has(id)) return;
    setSelectedLeft(id);
  };

  const handleSelectRight = async (id) => {
    if (selectedLeft === null || matched.has(id)) return;
    if (selectedLeft === id) {
      playSoundEffect('success');
      const updated = new Set([...matched, id]);
      setMatched(updated);
      setSelectedLeft(null);

      if (updated.size === pairs.length) {
        setFeedback('🌟 You matched all items correctly! Fantastic job!');
        if (onDone) onDone();
        try {
          await axiosClient.post(`/child/activities/${activityId}/submit`, {
            submission_text: JSON.stringify({ completed: true }),
            score: maxScore,
            auto_graded: true,
          });
        } catch {
          // silent
        }
      }
    } else {
      playSoundEffect('error');
      setSelectedLeft(null);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <p className="text-center text-sm font-extrabold text-slate-500">
        Tap an item on the left, then tap its match on the right!
      </p>

      <div className="grid grid-cols-2 gap-4">
        {/* Left Column */}
        <div className="space-y-3">
          {leftItems.map((item) => {
            const isDone = matched.has(item.id);
            const isSelected = selectedLeft === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectLeft(item.id)}
                disabled={isDone}
                className={`w-full rounded-2xl border-2 p-4 text-center font-black text-xl transition active:scale-95 shadow-sm ${
                  isDone
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 opacity-60'
                    : isSelected
                    ? 'border-indigo-600 bg-indigo-100 text-indigo-900 ring-2 ring-indigo-300'
                    : 'border-slate-200 bg-white text-slate-800 hover:border-indigo-300'
                }`}
              >
                {item.text} {isDone && '✓'}
              </button>
            );
          })}
        </div>

        {/* Right Column */}
        <div className="space-y-3">
          {rightItems.map((item) => {
            const isDone = matched.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectRight(item.id)}
                disabled={isDone}
                className={`w-full rounded-2xl border-2 p-4 text-center font-black text-xl transition active:scale-95 shadow-sm ${
                  isDone
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 opacity-60'
                    : selectedLeft !== null
                    ? 'border-indigo-300 bg-white hover:bg-indigo-50 text-slate-800'
                    : 'border-slate-200 bg-white text-slate-800'
                }`}
              >
                {item.text} {isDone && '✓'}
              </button>
            );
          })}
        </div>
      </div>

      {feedback && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-100 p-4 text-center font-black text-sm text-emerald-950 animate-fade-in">
          {feedback}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// INTERACTIVE COUNTING COMPONENT
// ----------------------------------------------------------------------------
function InteractiveCountingPlayer({ targetCount, itemEmoji, options, activityId, maxScore, playSoundEffect, onDone }) {
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const emojis = Array.from({ length: targetCount }, (_, i) => i);

  const handleSelect = async (num) => {
    setSelected(num);
    if (num === targetCount) {
      playSoundEffect('success');
      setFeedback('🎉 Correct! You counted them accurately!');
      if (onDone) onDone();
      try {
        await axiosClient.post(`/child/activities/${activityId}/submit`, {
          submission_text: String(num),
          score: maxScore,
          auto_graded: true,
        });
      } catch {
        // silent
      }
    } else {
      playSoundEffect('error');
      setFeedback('Count carefully and try again!');
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 text-center">
      <div className="flex flex-wrap items-center justify-center gap-3 rounded-3xl border-2 border-amber-200 bg-amber-50/50 p-6 shadow-inner">
        {emojis.map((idx) => (
          <span key={idx} className="text-5xl animate-bounce" style={{ animationDelay: `${idx * 80}ms` }}>
            {itemEmoji}
          </span>
        ))}
      </div>

      <p className="text-base font-black text-slate-800">How many do you see?</p>

      <div className="grid grid-cols-4 gap-3">
        {options.map((opt, idx) => {
          const isSelected = selected === opt;
          const isCorrect = isSelected && opt === targetCount;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelect(opt)}
              className={`rounded-2xl border-2 py-4 text-center font-black text-2xl transition active:scale-95 shadow-sm ${
                isCorrect
                  ? 'border-emerald-500 bg-emerald-100 text-emerald-900'
                  : isSelected
                  ? 'border-rose-400 bg-rose-50 text-rose-900'
                  : 'border-slate-200 bg-white text-slate-800 hover:border-amber-300'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {feedback && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3.5 text-center font-black text-sm text-indigo-900">
          {feedback}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// QUIZ STAGE (Child-friendly quiz questions)
// ----------------------------------------------------------------------------
function QuizStage({ resource, playSoundEffect, onDone }) {
  const quiz = resource.content?.quiz || {};
  const questions = quiz.questions || [];
  const [qIndex, setQIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const currentQ = questions[qIndex];

  if (!currentQ || questions.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-slate-200 bg-slate-50 p-8 text-center text-slate-600 font-bold">
        Practice quiz complete!
      </div>
    );
  }

  const options = Array.isArray(currentQ.options)
    ? currentQ.options
    : typeof currentQ.options === 'object'
    ? Object.values(currentQ.options)
    : ['True', 'False'];

  const handleAnswer = (option) => {
    setSelectedAnswer(option);
    playSoundEffect('success');

    setTimeout(() => {
      if (qIndex + 1 < questions.length) {
        setSelectedAnswer(null);
        setQIndex((prev) => prev + 1);
      } else {
        setFinished(true);
        if (onDone) onDone();
      }
    }, 600);
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 text-center">
      <div className="text-xs font-black uppercase tracking-wider text-purple-600">
        Question {qIndex + 1} of {questions.length}
      </div>
      <h3 className="text-xl font-black text-slate-900">{currentQ.question_text}</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((opt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleAnswer(opt)}
            className={`rounded-2xl border-2 p-4 text-center font-black text-base transition active:scale-95 shadow-sm ${
              selectedAnswer === opt
                ? 'border-purple-600 bg-purple-100 text-purple-950'
                : 'border-slate-200 bg-white text-slate-800 hover:border-purple-300'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// INTERACTIVE TRACING / WRITING PLAYER (Supports single or multi-character sequence like ሀ, ሁ, ሂ...)
// ----------------------------------------------------------------------------
function InteractiveTracingPlayer({
  traceChars = ['ሀ'],
  traceChar = 'ሀ',
  guideWord = '',
  guideSound = '',
  instructions = 'Trace each character carefully with your finger or mouse!',
  activityId,
  maxScore = 100,
  playSoundEffect,
  onDone,
}) {
  const characters = Array.isArray(traceChars) && traceChars.length > 0 ? traceChars : [traceChar || 'ሀ'];
  const [charIdx, setCharIdx] = useState(0);
  const [completedIndices, setCompletedIndices] = useState(new Set());
  const [allFinished, setAllFinished] = useState(false);

  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);
  const [color, setColor] = useState('#6366f1');
  const [lineWidth, setLineWidth] = useState(12);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const activeChar = characters[charIdx] || characters[0] || 'ሀ';
  const isCurrentCompleted = completedIndices.has(charIdx);

  const drawGuide = (ctx, width, height, charToDraw) => {
    ctx.clearRect(0, 0, width, height);

    // School guideline markers
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);

    ctx.beginPath();
    ctx.moveTo(20, height * 0.22);
    ctx.lineTo(width - 20, height * 0.22);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(20, height * 0.5);
    ctx.lineTo(width - 20, height * 0.5);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(20, height * 0.78);
    ctx.lineTo(width - 20, height * 0.78);
    ctx.stroke();

    ctx.setLineDash([]);

    // Watermark character
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `bold ${Math.round(height * 0.55)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(charToDraw, width / 2, height / 2);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = 320;
    canvas.height = 320;
    drawGuide(ctx, canvas.width, canvas.height, activeChar);
    setStrokeCount(0);
  }, [activeChar]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.touches && e.touches[0]) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e) => {
    if (allFinished) return;
    const { x, y } = getCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || allFinished) return;
    if (e.touches) e.preventDefault();
    const { x, y } = getCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDraw = () => {
    if (isDrawing) {
      setIsDrawing(false);
      setStrokeCount((prev) => prev + 1);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    drawGuide(ctx, canvas.width, canvas.height, activeChar);
    setStrokeCount(0);
  };

  const playSound = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    setIsPlayingAudio(true);
    window.speechSynthesis.cancel();
    const toSpeak = guideWord && charIdx === 0 ? `${activeChar}. ${guideWord}` : activeChar;
    const u = new SpeechSynthesisUtterance(toSpeak);
    u.lang = /[\u1200-\u137F]/.test(toSpeak) ? 'am-ET' : 'en-US';
    u.onend = () => setIsPlayingAudio(false);
    u.onerror = () => setIsPlayingAudio(false);
    window.speechSynthesis.speak(u);
  };

  const handleFinishCurrentChar = async () => {
    if (strokeCount === 0 && !isCurrentCompleted) {
      alert('Draw on the canvas to trace the character first!');
      return;
    }

    const nextCompleted = new Set(completedIndices);
    nextCompleted.add(charIdx);
    setCompletedIndices(nextCompleted);
    playSoundEffect('success');

    // Check if entire sequence is done
    if (nextCompleted.size >= characters.length) {
      setAllFinished(true);
      if (onDone) onDone();

      try {
        if (activityId) {
          await axiosClient.post(`/child/activities/${activityId}/submit`, {
            submission_text: JSON.stringify({ completed: true, characters, totalCompleted: nextCompleted.size }),
            score: maxScore,
            auto_graded: true,
          });
        }
      } catch {
        // silent
      }
    } else {
      // Advance to next uncompleted character
      if (charIdx < characters.length - 1) {
        setCharIdx(charIdx + 1);
      }
    }
  };

  const colors = [
    { id: '#6366f1', label: 'Indigo' },
    { id: '#ec4899', label: 'Pink' },
    { id: '#10b981', label: 'Emerald' },
    { id: '#f59e0b', label: 'Amber' },
    { id: '#3b82f6', label: 'Blue' },
    { id: '#8b5cf6', label: 'Purple' },
  ];

  return (
    <div className="mx-auto max-w-lg space-y-4 text-center">
      {/* Header with sequence progress */}
      <div className="flex items-center justify-between">
        <div className="text-left">
          <p className="text-xs font-black uppercase text-indigo-700 tracking-wider">
            Writing &amp; Tracing Practice {characters.length > 1 ? `(${charIdx + 1} of ${characters.length})` : ''}
          </p>
          <h3 className="text-xl font-black text-slate-800">
            Trace character &quot;{activeChar}&quot; {guideWord && charIdx === 0 ? `(${guideWord})` : ''}
          </h3>
        </div>
        <button
          type="button"
          onClick={playSound}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black hover:bg-indigo-100 transition cursor-pointer"
        >
          <span>{isPlayingAudio ? '🔊 Speaking...' : '🔊 Hear Sound'}</span>
        </button>
      </div>

      {/* Multi-character navigation tabs (e.g. ሀ, ሁ, ሂ, ሃ, ሄ, ህ, ሆ) */}
      {characters.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 flex-wrap p-2 bg-indigo-50/70 border border-indigo-100 rounded-2xl">
          {characters.map((ch, idx) => {
            const isCurrent = idx === charIdx;
            const isDone = completedIndices.has(idx);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setCharIdx(idx)}
                className={`relative min-w-[38px] h-10 px-2 rounded-xl font-black text-lg transition-all flex items-center justify-center cursor-pointer ${
                  isCurrent
                    ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300 scale-105'
                    : isDone
                    ? 'bg-emerald-100 border border-emerald-300 text-emerald-800 hover:bg-emerald-200'
                    : 'bg-white border border-slate-200 text-slate-700 hover:border-indigo-300'
                }`}
              >
                <span>{ch}</span>
                {isDone && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-xs font-semibold text-slate-500">{instructions}</p>

      {/* Tracing Canvas Container */}
      <div className="relative mx-auto w-[320px] h-[320px] rounded-3xl border-4 border-indigo-200 bg-amber-50/20 shadow-lg overflow-hidden touch-none select-none">
        <canvas
          ref={canvasRef}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
          className="w-full h-full cursor-crosshair"
        />
        {allFinished && (
          <div className="absolute inset-0 bg-emerald-500/25 backdrop-blur-[1px] flex flex-col items-center justify-center animate-fade-in pointer-events-none">
            <span className="text-6xl animate-bounce">🌟</span>
            <span className="text-lg font-black text-emerald-900 bg-white/95 px-5 py-2 rounded-full shadow-lg mt-2">
              🎉 Amazing! All {characters.length} characters completed!
            </span>
          </div>
        )}
      </div>

      {/* Canvas Tool Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded-2xl">
        {/* Colors */}
        <div className="flex items-center gap-1.5">
          {colors.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setColor(c.id)}
              className={`w-7 h-7 rounded-full transition transform hover:scale-110 cursor-pointer ${
                color === c.id ? 'ring-2 ring-slate-800 scale-110 shadow-sm' : ''
              }`}
              style={{ backgroundColor: c.id }}
              title={c.label}
            />
          ))}
        </div>

        {/* Thickness & Clear */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setLineWidth(lineWidth === 10 ? 18 : 10)}
            className="px-2.5 py-1 text-xs font-bold bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            {lineWidth === 10 ? '✏️ Regular' : '🖌️ Thick'}
          </button>
          <button
            type="button"
            onClick={clearCanvas}
            className="px-2.5 py-1 text-xs font-bold bg-white border border-rose-200 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
            title="Erase and restart"
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      {/* Check / Next / Finish Button */}
      <div>
        <button
          type="button"
          onClick={handleFinishCurrentChar}
          disabled={allFinished}
          className={`w-full py-3.5 px-6 rounded-2xl font-black text-base shadow-lg transition active:scale-95 cursor-pointer ${
            allFinished
              ? 'bg-emerald-600 text-white cursor-default'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
        >
          {allFinished
            ? '✓ All Characters Traced! Great Job ⭐'
            : charIdx < characters.length - 1
            ? `✓ Check & Next Character (${characters[charIdx + 1]}) →`
            : '⭐ Done Writing! Complete Exercise'}
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// INTERACTIVE AUDIO PICKER / LISTEN & MATCH PLAYER
// Generic for letters, animals, math, words, colors, or symbols!
// ----------------------------------------------------------------------------
function InteractiveAudioPickerPlayer({
  audioUrl = '',
  audioSound = 'ሀ',
  options = ['ሀ', 'ሁ', 'ሂ', 'ሃ'],
  correctAnswer = 'ሀ',
  question = 'What did you hear?',
  instructions = 'Listen carefully and tap the matching choice!',
  activityId,
  maxScore = 100,
  playSoundEffect,
  onDone,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [completed, setCompleted] = useState(false);
  const audioRef = useRef(null);

  const playAudio = () => {
    setIsPlaying(true);
    if (audioUrl) {
      try {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const resolved = resolveFileUrl(audioUrl);
        const a = new Audio(resolved);
        audioRef.current = a;
        a.play()
          .then(() => {
            a.onended = () => setIsPlaying(false);
          })
          .catch(() => {
            playTTS();
          });
        return;
      } catch {
        playTTS();
        return;
      }
    }
    playTTS();
  };

  const playTTS = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setIsPlaying(false);
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(audioSound);
    u.lang = /[\u1200-\u137F]/.test(audioSound) ? 'am-ET' : 'en-US';
    u.onend = () => setIsPlaying(false);
    u.onerror = () => setIsPlaying(false);
    window.speechSynthesis.speak(u);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      playAudio();
    }, 400);
    return () => clearTimeout(timer);
  }, [audioUrl, audioSound]);

  const handleSelect = async (opt) => {
    if (completed) return;
    setSelectedOption(opt);
    const isCorrect = String(opt).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();

    if (isCorrect) {
      setCompleted(true);
      playSoundEffect('success');
      setFeedback({
        correct: true,
        message: '🎉 Brilliant! You listened carefully and picked the correct answer!',
      });
      if (onDone) onDone();

      try {
        if (activityId) {
          await axiosClient.post(`/child/activities/${activityId}/submit`, {
            submission_text: String(opt),
            score: maxScore,
            auto_graded: true,
          });
        }
      } catch {
        // silent
      }
    } else {
      playSoundEffect('error');
      setFeedback({
        correct: false,
        message: '🤔 Not quite. Tap the speaker to listen again, then try another choice!',
      });
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 text-center">
      <div className="space-y-1">
        <span className="text-xs font-black uppercase text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
          🎧 Listen &amp; Pick
        </span>
        <h3 className="text-xl sm:text-2xl font-black text-slate-800 pt-1">
          {question}
        </h3>
        <p className="text-xs font-semibold text-slate-500">{instructions}</p>
      </div>

      {/* Big Interactive Speaker Button */}
      <div className="py-2">
        <button
          type="button"
          onClick={playAudio}
          className={`group mx-auto flex flex-col items-center justify-center p-6 sm:p-8 rounded-3xl border-4 transition-all duration-300 shadow-xl active:scale-95 cursor-pointer ${
            isPlaying
              ? 'border-purple-500 bg-gradient-to-br from-purple-100 to-indigo-100 scale-105 ring-4 ring-purple-200'
              : 'border-purple-300 bg-gradient-to-br from-purple-50 to-white hover:border-purple-400 hover:shadow-2xl'
          }`}
        >
          <span className={`text-6xl block transition transform ${isPlaying ? 'scale-125 animate-pulse' : 'group-hover:scale-110'}`}>
            🔊
          </span>
          <span className="mt-3 text-sm font-black text-purple-900 flex items-center gap-1.5">
            {isPlaying ? (
              <>
                <span className="w-2 h-2 rounded-full bg-purple-600 animate-ping" />
                Listening to Sound...
              </>
            ) : (
              'Tap to Listen Again 🔄'
            )}
          </span>
        </button>
      </div>

      {/* Choice Options */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {options.map((opt, idx) => {
          const isSelected = selectedOption === opt;
          const isCorrect = completed && isSelected;
          const isLongText = String(opt).length > 3;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelect(opt)}
              disabled={completed}
              className={`min-h-[80px] sm:min-h-[96px] p-3 rounded-3xl border-4 transition-all duration-200 flex flex-col items-center justify-center shadow-md active:scale-95 cursor-pointer ${
                isLongText ? 'text-base sm:text-lg font-black' : 'text-3xl sm:text-4xl font-black'
              } ${
                isCorrect
                  ? 'border-emerald-500 bg-emerald-100 text-emerald-950 ring-4 ring-emerald-200 scale-105'
                  : isSelected && !completed
                  ? 'border-rose-400 bg-rose-50 text-rose-900 animate-shake'
                  : 'border-slate-200 bg-white text-slate-800 hover:border-purple-300 hover:bg-purple-50/50'
              }`}
            >
              <span className="break-words line-clamp-2">{opt}</span>
              {isCorrect && <span className="text-[11px] font-black text-emerald-700 mt-1">✓ Correct!</span>}
            </button>
          );
        })}
      </div>

      {feedback && (
        <div
          className={`rounded-2xl p-4 text-center font-black text-sm animate-fade-in ${
            feedback.correct
              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              : 'bg-rose-100 text-rose-900 border border-rose-300'
          }`}
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// INTERACTIVE MATH OPERATION PLAYER (+, -, ×, ÷ with visual emoji counters)
// Supports single problem or multiple problems in sequence
// ----------------------------------------------------------------------------
function InteractiveMathOperationPlayer({
  problems = [],
  numA = 3,
  numB = 2,
  operator = '+',
  question,
  options = ['4', '5', '6', '7'],
  correctAnswer = '5',
  itemEmoji = '🍎',
  activityId,
  maxScore = 100,
  playSoundEffect,
  onDone,
}) {
  const normalizedProblems = Array.isArray(problems) && problems.length > 0
    ? problems.map((p, idx) => {
        const a = Number(p.numA ?? p.operation_a ?? 3);
        const b = Number(p.numB ?? p.operation_b ?? 2);
        const op = p.operator || '+';
        let calculated = '';
        if (op === '+') calculated = String(a + b);
        else if (op === '-') calculated = String(Math.max(0, a - b));
        else if (op === '×' || op === '*') calculated = String(a * b);
        else if (op === '÷' || op === '/') calculated = b !== 0 ? String(Math.round(a / b * 10) / 10) : '0';
        else calculated = String(a + b);

        const ans = String(p.correctAnswer ?? p.correct_answer ?? calculated);
        const rawOpts = (p.options || []).filter((o) => typeof o === 'string' && o.trim().length > 0);
        const opts = rawOpts.length >= 2 ? rawOpts : [
          String(Number(ans) - 1),
          ans,
          String(Number(ans) + 1),
          String(Number(ans) + 2),
        ].sort(() => Math.random() - 0.5);

        return {
          id: p.id || `prob-${idx}`,
          numA: a,
          numB: b,
          operator: op,
          question: p.question || `What is ${a} ${op} ${b}?`,
          correctAnswer: ans,
          options: opts,
          itemEmoji: p.itemEmoji || p.item_emoji || '🍎',
        };
      })
    : [{
        id: 'prob-default',
        numA: Number(numA),
        numB: Number(numB),
        operator: operator,
        question: question || `What is ${numA} ${operator} ${numB}?`,
        correctAnswer: String(correctAnswer),
        options: options,
        itemEmoji: itemEmoji,
      }];

  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [completedThis, setCompletedThis] = useState(false);
  const [allFinished, setAllFinished] = useState(false);

  const curr = normalizedProblems[currentIdx] || normalizedProblems[0];

  const handleSelect = async (opt) => {
    if (completedThis || allFinished) return;
    setSelected(opt);
    const isCorrect = String(opt).trim() === String(curr.correctAnswer).trim();

    if (isCorrect) {
      setCompletedThis(true);
      playSoundEffect('success');

      if (currentIdx < normalizedProblems.length - 1) {
        setFeedback({
          correct: true,
          message: '🎉 Correct! Next question coming up...',
        });
        setTimeout(() => {
          setCurrentIdx((prev) => prev + 1);
          setSelected(null);
          setFeedback(null);
          setCompletedThis(false);
        }, 900);
      } else {
        setAllFinished(true);
        setFeedback({
          correct: true,
          message: '🏆 Fantastic! You solved all math problems correctly!',
        });
        if (onDone) onDone();

        try {
          if (activityId) {
            await axiosClient.post(`/child/activities/${activityId}/submit`, {
              submission_text: String(opt),
              score: maxScore,
              auto_graded: true,
            });
          }
        } catch {
          // silent
        }
      }
    } else {
      playSoundEffect('error');
      setFeedback({
        correct: false,
        message: '🤔 Count the items carefully and try again!',
      });
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 text-center">
      <div className="space-y-1">
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs font-black uppercase text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
            ➕ Math Practice
          </span>
          {normalizedProblems.length > 1 && (
            <span className="text-xs font-black text-amber-800 bg-amber-200/70 px-2.5 py-1 rounded-full">
              Question {currentIdx + 1} of {normalizedProblems.length}
            </span>
          )}
        </div>
        <h3 className="text-2xl font-black text-slate-900 pt-1">{curr.question}</h3>
      </div>

      {/* Visual Counters */}
      <div className="bg-gradient-to-r from-amber-50 via-white to-orange-50 border-2 border-amber-200 rounded-3xl p-6 shadow-sm flex items-center justify-center gap-3 sm:gap-6 flex-wrap">
        {/* Group A */}
        <div className="flex flex-col items-center">
          <div className="flex flex-wrap items-center justify-center gap-1 max-w-[120px] min-h-[50px]">
            {Array.from({ length: Math.min(12, curr.numA) }).map((_, i) => (
              <span key={i} className="text-2xl animate-bounce" style={{ animationDelay: `${i * 80}ms` }}>
                {curr.itemEmoji}
              </span>
            ))}
          </div>
          <span className="text-xl font-black text-slate-800 mt-1">{curr.numA}</span>
        </div>

        {/* Operator */}
        <span className="text-3xl font-black text-amber-600 px-1">{curr.operator}</span>

        {/* Group B */}
        <div className="flex flex-col items-center">
          <div className="flex flex-wrap items-center justify-center gap-1 max-w-[120px] min-h-[50px]">
            {Array.from({ length: Math.min(12, curr.numB) }).map((_, i) => (
              <span key={i} className="text-2xl animate-bounce" style={{ animationDelay: `${(i + curr.numA) * 80}ms` }}>
                {curr.itemEmoji}
              </span>
            ))}
          </div>
          <span className="text-xl font-black text-slate-800 mt-1">{curr.numB}</span>
        </div>

        {/* Equals */}
        <span className="text-3xl font-black text-slate-400">=</span>

        {/* Target */}
        <div className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center font-black text-2xl ${
          completedThis || allFinished
            ? 'bg-emerald-500 text-white border-emerald-400'
            : 'bg-white border-dashed border-amber-400 text-amber-600'
        }`}>
          {completedThis || allFinished ? curr.correctAnswer : '?'}
        </div>
      </div>

      {/* Options */}
      <div className="grid grid-cols-4 gap-3">
        {curr.options.map((opt, idx) => {
          const isSelected = selected === opt;
          const isCorrect = (completedThis || allFinished) && isSelected;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelect(opt)}
              disabled={completedThis || allFinished}
              className={`rounded-2xl border-2 py-4 text-center font-black text-2xl transition active:scale-95 shadow-sm cursor-pointer ${
                isCorrect
                  ? 'border-emerald-500 bg-emerald-100 text-emerald-950 scale-105'
                  : isSelected && !completedThis
                  ? 'border-rose-400 bg-rose-50 text-rose-900'
                  : 'border-slate-200 bg-white text-slate-800 hover:border-amber-300'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {feedback && (
        <div
          className={`rounded-2xl p-4 text-center font-black text-sm animate-fade-in ${
            feedback.correct
              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              : 'bg-rose-100 text-rose-900 border border-rose-300'
          }`}
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
}

