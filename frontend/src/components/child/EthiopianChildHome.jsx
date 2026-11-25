import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useVoiceGuide from '../../hooks/useVoiceGuide';
import useReferenceKit from '../../hooks/useReferenceKit';
import { timeOfDayGreeting } from '../../utils/ethiopianLearning';
import { tileMetaFor, wordsFromPins } from '../../utils/practiceContent';
import { resolveFileUrl } from '../../utils/fileUrl';

const learningSteps = [
  { icon: '▶', title: 'Watch and listen', detail: 'See a new idea' },
  { icon: '♧', title: 'Practice with pictures', detail: 'Try it together' },
  { icon: '✣', title: 'Try the activity', detail: 'Show what you know' },
  { icon: '✓', title: 'Finish with a quiz', detail: 'Celebrate your learning' },
];

/** A calm, picture-led home that puts the instructor's next lesson first. */
export default function EthiopianChildHome({ data, loading, error, onRetry, onStartRecommendation, startingRecommendationId, recommendationNotice }) {
  const voice = useVoiceGuide({ lang: 'am' });
  const { reference } = useReferenceKit();
  const child = data?.child || {};
  const stats = data?.stats || {};
  const lesson = data?.continue_learning;
  const courses = data?.courses || [];
  const homePins = data?.home_pins || [];
  const announcements = data?.announcements || [];
  const recommendation = data?.recommendation;
  const greeting = useMemo(() => timeOfDayGreeting(), []);
  const words = useMemo(() => wordsFromPins(homePins, reference, 4), [homePins, reference]);
  const firstName = child.full_name?.split(' ')[0] || 'friend';

  useEffect(() => {
    if (!child.full_name || typeof window === 'undefined') return;
    const key = `brana_greeted_${child.id || child.full_name}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, 'true');
    voice.speak([{ text: greeting.amharic, lang: 'am' }, { text: firstName, lang: 'am' }]);
    // Speak once per login session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child.full_name, child.id]);

  if (loading) return <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4 text-center"><span className="text-6xl animate-bounce" aria-hidden="true">🌱</span><p className="text-lg font-extrabold text-amber-900">Getting your learning space ready…</p></div>;

  if (error) {
    const authError = error === 'Please log in to continue';
    return <div className="mx-auto my-12 max-w-lg rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm"><span className="text-5xl" aria-hidden="true">{authError ? '🔒' : '🌤️'}</span><h1 className="mt-3 text-xl font-black text-slate-900">{authError ? 'Please log in' : 'Let’s try that again'}</h1><p className="mt-2 text-sm text-slate-600">{error}</p>{authError ? <Link to="/login" className="mt-5 inline-flex rounded-xl bg-amber-700 px-5 py-3 font-bold text-white">Go to login</Link> : <button onClick={onRetry} className="mt-5 rounded-xl bg-amber-700 px-5 py-3 font-bold text-white">Try again</button>}</div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10 text-[#523b23]">
      <header className="flex flex-wrap items-center justify-between gap-3 px-1 pt-1">
        <div><p className="text-sm font-bold text-amber-800">{greeting.amharic}</p><h1 className="text-2xl font-black tracking-tight sm:text-3xl">Hi, {firstName}! <span aria-hidden="true">☀️</span></h1><p className="mt-1 text-sm text-stone-600">Let’s learn something fun today.</p></div>
        {child.grade_level_name && <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-amber-900 shadow-sm">{child.grade_level_name}</span>}
      </header>

      {recommendationNotice && <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{recommendationNotice}</p>}

      {recommendation ? <RecommendedLesson recommendation={recommendation} onStart={onStartRecommendation} starting={startingRecommendationId === recommendation.id} /> : lesson ? <ContinueLesson lesson={lesson} /> : courses[0] ? <CourseWelcome course={courses[0]} /> : <section className="rounded-[2rem] border-2 border-dashed border-amber-200 bg-white px-6 py-12 text-center"><span className="text-6xl" aria-hidden="true">📚</span><h2 className="mt-4 text-2xl font-black">Your lessons are on the way!</h2><p className="mx-auto mt-2 max-w-md text-stone-600">Your teacher will add a lesson here soon. Come back and learn together.</p></section>}

      <section className="rounded-[1.6rem] bg-white px-5 py-5 shadow-sm sm:px-7" aria-label="Today's learning steps">
        <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-amber-700">Your lesson adventure</p><h2 className="text-xl font-black">Today’s learning steps</h2></div><span className="text-3xl" aria-hidden="true">🧭</span></div>
        <ol className="grid gap-3 sm:grid-cols-2">
          {learningSteps.map((step, index) => <li key={step.title} className="flex items-center gap-3 rounded-2xl bg-[#fffaf0] p-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-lg font-black text-white" aria-hidden="true">{step.icon}</span><span><span className="block font-bold">{step.title}</span><span className="block text-xs text-stone-500">Step {index + 1} · {step.detail}</span></span></li>)}
        </ol>
      </section>

      <section aria-label="Your progress" className="grid grid-cols-3 divide-x divide-amber-100 rounded-3xl border border-amber-100 bg-white py-4 shadow-sm">
        <ProgressItem icon="📘" value={stats.total_courses || courses.length} label="My courses" />
        <ProgressItem icon="✅" value={(stats.completed_activities || 0) + (stats.completed_quizzes || 0)} label="Things I did" />
        <ProgressItem icon="🔥" value={data?.learning_streak || 0} label="Day streak" />
      </section>

      {homePins.length > 0 && <section><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-amber-800">Picked by your teacher</p><h2 className="text-xl font-black">More fun practice</h2></div>{homePins.length > 3 && <Link to="/child/activities" className="text-sm font-bold text-amber-900 underline-offset-4 hover:underline">See all</Link>}</div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{homePins.slice(0, 3).map((pin, index) => <PracticeTile key={pin.pin_id} pin={pin} index={index} />)}</div></section>}

      {words.length > 0 && <section className="flex flex-col gap-3 rounded-2xl bg-amber-100/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-amber-900">Say it out loud</p><p className="font-bold">Practice a new word</p></div><div className="flex flex-wrap gap-2">{words.slice(0, 3).map((item) => <button key={item.word} onClick={() => voice.speak([{ text: item.word, lang: 'am' }])} className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-bold transition hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700"><span className="mr-1" aria-hidden="true">{item.emoji}</span>{item.word}</button>)}</div></section>}

      {announcements.length > 0 && <section className="space-y-3" aria-label="School announcements">{announcements.map((ann) => <article key={ann.id} className={`rounded-2xl border p-4 ${ann.priority === 'urgent' ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}><p className="text-xs font-bold uppercase tracking-wide text-amber-800">📣 A note from school</p><h2 className="mt-1 font-black">{ann.title}</h2><p className="mt-1 whitespace-pre-line text-sm">{ann.message || ann.content}</p></article>)}</section>}
    </div>
  );
}

function RecommendedLesson({ recommendation, onStart, starting }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = recommendation.thumbnail_url ? resolveFileUrl(recommendation.thumbnail_url) : null;
  const subject = recommendation.subject_name || recommendation.course_title || 'Your lesson';
  const lessonNumber = Number(recommendation.order_index) > 0 ? `Lesson ${recommendation.order_index}` : 'Your next lesson';
  return <article className="overflow-hidden rounded-[1.8rem] border border-amber-100 bg-[#fff9eb] shadow-md">
    <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 sm:px-7"><p className="font-bold text-amber-900">{subject}</p><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">✨ Picked for you</span></div>
    <div className="px-5 pb-4 pt-3 sm:px-7"><p className="text-xs font-bold uppercase tracking-wider text-amber-700">{lessonNumber}</p><h2 className="mt-1 text-2xl font-black leading-tight sm:text-3xl">{recommendation.title}</h2><p className="mt-1 text-sm text-stone-600">{recommendation.reason || 'Your teacher picked this lesson for you.'}</p></div>
    <div className="relative mx-4 aspect-[16/8] overflow-hidden rounded-2xl bg-gradient-to-br from-sky-200 via-amber-100 to-emerald-200 sm:mx-7">
      {imageUrl && !imageFailed ? <img src={imageUrl} alt="" className="h-full w-full object-cover" onError={() => setImageFailed(true)} /> : <div className="flex h-full items-center justify-center gap-3 text-7xl sm:gap-8 sm:text-8xl" aria-hidden="true"><span>🧸</span><span>🔢</span><span>🌈</span></div>}
      <div className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-amber-950">{recommendation.estimated_duration_minutes ? `About ${recommendation.estimated_duration_minutes} minutes` : 'Learn at your own pace'}</div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-7"><p className="text-sm font-semibold text-stone-600">{recommendation.course_title || 'Ready when you are!'}</p><button type="button" onClick={() => onStart?.(recommendation)} disabled={starting} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 text-base font-black text-amber-950 shadow-sm transition hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800 disabled:cursor-wait disabled:opacity-70">{starting ? 'Opening your lesson…' : 'Let’s learn!'} <span aria-hidden="true">→</span></button></div>
  </article>;
}

function ContinueLesson({ lesson }) {
  const imageUrl = lesson.thumbnail_url || lesson.course_thumbnail;
  return <article className="overflow-hidden rounded-[1.8rem] border border-amber-100 bg-[#fff9eb] shadow-md"><div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 sm:px-7"><p className="font-bold text-amber-900">{lesson.course_title || 'Keep learning'}</p><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">Continue your lesson</span></div><div className="px-5 pb-4 pt-3 sm:px-7"><h2 className="text-2xl font-black leading-tight sm:text-3xl">{lesson.title}</h2><p className="mt-1 text-sm text-stone-600">Pick up where you left off.</p></div><div className="mx-4 aspect-[16/8] overflow-hidden rounded-2xl bg-gradient-to-br from-sky-200 via-amber-100 to-emerald-200 sm:mx-7">{imageUrl ? <img src={resolveFileUrl(imageUrl)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center gap-3 text-7xl sm:gap-8 sm:text-8xl" aria-hidden="true">🧸　📚　🌈</div>}</div><div className="flex justify-end px-5 py-5 sm:px-7"><Link to={`/child/lessons/${lesson.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 text-base font-black text-amber-950 shadow-sm transition hover:bg-amber-400">Continue learning <span aria-hidden="true">→</span></Link></div></article>;
}

function CourseWelcome({ course }) {
  return <Link to={`/child/courses/${course.id}`} className="flex flex-col gap-5 rounded-[1.8rem] bg-gradient-to-br from-amber-700 to-orange-500 p-7 text-white shadow-md sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-amber-100">Your learning path</p><h2 className="mt-2 text-3xl font-black">{course.title}</h2><p className="mt-1">Your teacher has a lesson ready for you.</p></div><span className="rounded-2xl bg-white px-6 py-4 text-lg font-black text-amber-900">Start learning →</span></Link>;
}

function ProgressItem({ icon, value, label }) { return <div className="px-2 text-center"><span className="text-xl" aria-hidden="true">{icon}</span><p className="mt-1 text-xl font-black">{value}</p><p className="text-xs font-semibold text-stone-500">{label}</p></div>; }

function PracticeTile({ pin, index }) {
  const meta = tileMetaFor(pin);
  const isPractice = ['letter_tracing', 'counting', 'matching'].includes(pin.kind);
  const to = isPractice ? `/child/practice/${pin.id}` : `/child/lessons/${pin.lesson_id}`;
  return <Link to={to} className="group flex items-center gap-4 rounded-2xl border border-amber-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700" style={{ animationDelay: `${index * 0.08}s` }}><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-3xl transition group-hover:scale-105" aria-hidden="true">{meta.emoji}</span><span className="min-w-0 flex-1"><span className="block truncate font-black">{pin.title}</span><span className="mt-0.5 block truncate text-xs font-medium text-stone-500">{pin.lesson_title || (isPractice ? 'Practice game' : 'Lesson')}</span></span><span className="text-xl font-black text-amber-700" aria-hidden="true">→</span></Link>;
}
