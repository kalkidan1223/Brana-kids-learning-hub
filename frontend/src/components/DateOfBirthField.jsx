import { useEffect, useState } from 'react';
import {
  ETHIOPIAN_MONTHS,
  ETHIOPIAN_MONTHS_AMHARIC,
  ethiopianMonthLength,
  ethiopianToGregorianISO,
  gregorianISOToEthiopian,
  isValidEthiopianDate,
  formatEthiopianDate,
} from '../utils/ethiopianDate';

// Date of birth entry that accepts either the Ethiopian (Ge'ez) calendar or
// the Gregorian one. Whichever calendar the user picks, `onChange` always
// receives a Gregorian 'YYYY-MM-DD' string so the API contract is unchanged.
export default function DateOfBirthField({
  value,
  onChange,
  label = 'Date of Birth',
  required = false,
  accentColor = 'emerald', // 'emerald' | 'blue'
  size = 'normal', // 'normal' | 'compact'
  className = '',
}) {
  const [calendar, setCalendar] = useState('ethiopian');
  const [et, setEt] = useState({ year: '', month: '', day: '' });

  // Keep the Ethiopian inputs in sync when the value changes elsewhere
  // (initial load, switching calendars, resetting the form).
  useEffect(() => {
    const parsed = gregorianISOToEthiopian(value);
    if (parsed) setEt({ year: String(parsed.year), month: String(parsed.month), day: String(parsed.day) });
    else if (!value) setEt({ year: '', month: '', day: '' });
  }, [value]);

  const selectedEtYear = Number(et.year);
  const selectedEtMonth = Number(et.month);

  // Pagume (month 13) strictly has 5 days in a common year, 6 in a leap year (never 30!).
  // When year is not yet entered, default to max 6 so the dropdown never overflows to 30.
  const maxDay = (() => {
    if (selectedEtMonth === 13) {
      if (Number.isInteger(selectedEtYear) && selectedEtYear > 0) {
        return ethiopianMonthLength(selectedEtYear, 13);
      }
      return 6;
    }
    return 30;
  })();

  function updateEthiopian(part) {
    return (e) => {
      const next = { ...et, [part]: e.target.value };
      const year = Number(next.year);
      const month = Number(next.month);
      let day = Number(next.day);

      // If Pagume (month 13) is selected, clamp day if it exceeds Pagume's max days (5 or 6)
      if (month === 13) {
        const pagumeMax = Number.isInteger(year) && year > 0 ? ethiopianMonthLength(year, 13) : 6;
        if (day > pagumeMax) {
          next.day = String(pagumeMax);
          day = pagumeMax;
        }
      }

      setEt(next);

      if (isValidEthiopianDate(year, month, day)) {
        onChange(ethiopianToGregorianISO(year, month, day));
      } else {
        onChange('');
      }
    };
  }

  const gregorianPreview = value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const ethiopianPreview = value ? formatEthiopianDate(value) : '';

  const isCompact = size === 'compact';
  const isBlue = accentColor === 'blue';

  const activeToggleClass = isBlue
    ? 'bg-blue-600 text-white shadow-sm font-bold'
    : 'bg-emerald-500 text-white shadow font-bold';

  const fieldClass = isCompact
    ? `w-full rounded-xl border border-slate-200 bg-slate-50 py-2 px-2.5 text-xs font-medium text-slate-800 transition focus:bg-white focus:outline-none focus:ring-2 ${
        isBlue ? 'focus:ring-blue-500 focus:border-blue-500' : 'focus:ring-emerald-500 focus:border-emerald-500'
      }`
    : `w-full rounded-xl border-2 border-slate-200 bg-white py-3 px-3 text-sm font-medium text-slate-800 transition focus:outline-none focus:ring-4 ${
        isBlue
          ? 'focus:border-blue-500 focus:ring-blue-100'
          : 'focus:border-emerald-400 focus:ring-emerald-100'
      }`;

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-2 flex-wrap">
        <label className={`block font-bold text-slate-700 ${isCompact ? 'text-xs' : 'text-sm'}`}>
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
          {[
            { key: 'ethiopian', label: '🇪🇹 Ethiopian' },
            { key: 'gregorian', label: '🌐 Gregorian' },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setCalendar(option.key)}
              className={`rounded-md px-2.5 py-1 text-xs transition ${
                calendar === option.key ? activeToggleClass : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {calendar === 'ethiopian' ? (
        <div className="space-y-1.5">
          <div className="grid grid-cols-12 gap-1.5 sm:gap-2">
            {/* Month: 5 cols */}
            <div className="col-span-5 sm:col-span-5">
              <select
                value={et.month}
                onChange={updateEthiopian('month')}
                className={fieldClass}
                aria-label="Ethiopian month"
              >
                <option value="">ወር / Month</option>
                {ETHIOPIAN_MONTHS.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {ETHIOPIAN_MONTHS_AMHARIC[i]} ({name})
                  </option>
                ))}
              </select>
            </div>

            {/* Day: 3 cols */}
            <div className="col-span-3 sm:col-span-3">
              <select
                value={et.day}
                onChange={updateEthiopian('day')}
                className={fieldClass}
                aria-label="Ethiopian day"
              >
                <option value="">ቀን</option>
                {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Year: 4 cols */}
            <div className="col-span-4 sm:col-span-4">
              <input
                type="number"
                inputMode="numeric"
                min="1980"
                max="2030"
                placeholder="ዓመት (Year)"
                value={et.year}
                onChange={updateEthiopian('year')}
                className={fieldClass}
                aria-label="Ethiopian year"
              />
            </div>
          </div>

          {selectedEtMonth === 13 ? (
            <p className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">
              ℹ️ <strong>ጳጉሜ (Pagume):</strong> 5 ቀናት (በዘመነ ሉቃስ / Leap Year 6 ቀናት) ናት።
            </p>
          ) : (
            <p className="text-[11px] text-slate-500">
              🇪🇹 የኢትዮጵያ ዘመን አቆጣጠር (e.g. መስከረም 15, 2011 ዓ.ም.)
            </p>
          )}
        </div>
      ) : (
        <div>
          <input
            type="date"
            required={required}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={fieldClass}
            aria-label="Date of birth"
          />
        </div>
      )}

      {value && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
          <span className="font-semibold text-slate-700">
            {calendar === 'ethiopian' ? 'Equivalent Gregorian:' : 'Equivalent Ethiopian:'}
          </span>
          <span className="font-bold text-slate-900">
            {calendar === 'ethiopian' ? gregorianPreview : ethiopianPreview}
          </span>
        </div>
      )}
    </div>
  );
}
