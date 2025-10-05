import React from 'react';
import type { ELDLog } from '../lib/types';


export type ELDTimelineProps = {
  data: ELDLog[];
};

function toSeconds(date: string | Date) {
  const dateObj = typeof date !== "string" ? date : new Date(date);

  const hours = dateObj.getHours();
  const minutes = dateObj.getMinutes();
  const seconds = dateObj.getSeconds();
  const milliseconds = dateObj.getMilliseconds();

  const totalSeconds = (
    (hours * 3600) +
    (minutes * 60) +
    seconds +
    (milliseconds / 1000)
  );

  return totalSeconds;
}

function secToHms(seconds: number): string {
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds % 3600) / 60);
  const h = Math.floor(seconds / 3600);
  return `${h}h ${m}m${s ? ` ${s}s` : ''}`;
}

function formatDateIso(iso: string | Date): string {
  try {
    const d = typeof iso === 'string' ? new Date(iso) : iso;
    return d.toLocaleString();
  } catch (e) {
    return String(iso);
  }
}

const COLOR_MAP: Record<string, string> = {
  drive: 'bg-red-600',
  off_duty: 'bg-green-600',
  on_duty: 'bg-yellow-400',
};

const BORDER_MAP: Record<string, string> = {
  drive: 'ring-1 ring-red-700',
  off_duty: 'ring-1 ring-green-700',
  on_duty: 'ring-1 ring-yellow-600',
};

const DAY_TOTAL_SECONDS = 24 * 3600;

const ELDTimeline: React.FC<ELDTimelineProps> = ({ data }) => {
  return (
    <div className="p-4 max-w-6xl mx-auto font-sans">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">ELD Timeline</h2>
          <p className="text-sm text-gray-400">Visual timeline of daily ELD events (drive / on-duty / off-duty).</p>
        </div>
        <div className="text-sm text-gray-300">
          <div>Days: <strong className="text-indigo-300">{data?.length ?? 0}</strong></div>
        </div>
      </header>

      <div className="space-y-6">
        {data?.map((day, idx) => {
          const startDateLabel = formatDateIso(day.start_time);

          return (
            <section key={idx} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm text-gray-400">Day start</div>
                  <div className="text-base font-medium text-indigo-200">{startDateLabel}</div>
                </div>

                <div className="flex gap-4 items-center text-xs text-gray-300">
                  <div>Driving: <span className="font-mono text-indigo-300">{secToHms(day.total_driving)}</span></div>
                  <div>Off duty: <span className="font-mono text-indigo-300">{secToHms(day.total_off_duty)}</span></div>
                  <div>On duty: <span className="font-mono text-indigo-300">{secToHms(day.total_on_duty)}</span></div>
                </div>
              </div>

              <div className="relative h-12 bg-gray-900 rounded overflow-hidden border border-gray-700">
                <div className="absolute inset-0 pointer-events-none">
                  <div className="h-full w-full relative">
                    {Array.from({ length: 25 }).map((_, i) => (
                      <div key={`rule-${i}`} style={{ left: `${(i / 24) * 100}%` }} className="absolute top-0 bottom-0 w-px bg-gray-700 opacity-60" />
                    ))}

                    {Array.from({ length: 24 }).map((_, i) => (
                      <div key={`label-${i}`} style={{ left: `${(i / 24) * 100}%` }} className="absolute top-0 pl-1 transform -translate-x-0 text-[10px] text-gray-400">
                        <span style={{ position: 'absolute', top: '100%', marginTop: 4 }}>{i}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="relative h-full">
                  {day.log_events?.map((ev, eidx) => {
                    const startDate = new Date(day.start_time);
                    const midnight = new Date(startDate);
                    midnight.setUTCHours(0, 0, 0, 0);
                    const offsetFromMidnight =
                      (startDate.getTime() - midnight.getTime()) / 1000;

                    const eventStartSec = offsetFromMidnight + ev.time_from_start_seconds;
                    const leftPct = Math.max(0, (eventStartSec / DAY_TOTAL_SECONDS) * 100);

                    const widthPct = Math.max(0.5, (ev.duration_seconds / DAY_TOTAL_SECONDS) * 100);

                    const cls = COLOR_MAP[ev.event_type] ?? "bg-gray-600";
                    const br = BORDER_MAP[ev.event_type] ?? "";

                    const tooltip = `${ev.event_type.toUpperCase()} • ${secToHms(ev.duration_seconds)} • start: ${secToHms(ev.time_from_start_seconds)}${ev.remark ? " • " + ev.remark : ""}`;

                    return (
                      <div
                        key={eidx}
                        className={`absolute top-1 bottom-1 rounded-md ${cls} ${br} overflow-hidden`}
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          cursor: "pointer",
                        }}
                        title={tooltip}
                        aria-label={tooltip}
                      >
                        <div className="h-full w-full flex items-center pl-2 text-xs text-black/90 font-medium">
                          {widthPct > 6 ? (
                            <span className="truncate">{ev.event_type.toUpperCase()}</span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-300">
                <div>
                  <div className="font-semibold text-gray-200">Events</div>
                  <ul className="mt-1 space-y-1">
                    {day.log_events?.map((ev, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className={`inline-block w-2 h-2 mt-1 rounded-full ${COLOR_MAP[ev.event_type] ?? 'bg-gray-600'}`} />
                        <div>
                          <div className="text-gray-100 text-sm">
                            {ev.event_type.toUpperCase()} <span className="text-gray-400">· {secToHms(ev.duration_seconds)}</span>
                          </div>
                          {ev.remark && <div className="text-xs text-gray-500">{ev.remark}</div>}
                          <div className="text-xs text-gray-500">Start: {secToHms(ev.time_from_start_seconds)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="font-semibold text-gray-200">Legend</div>
                  <div className="mt-1 space-y-1 text-xs text-gray-300">
                    <div className="flex items-center gap-2"><span className="w-4 h-3 rounded bg-red-600"></span> Drive</div>
                    <div className="flex items-center gap-2"><span className="w-4 h-3 rounded bg-green-600"></span> Off duty</div>
                    <div className="flex items-center gap-2"><span className="w-4 h-3 rounded bg-yellow-400"></span> On duty</div>
                  </div>
                </div>
              </div>

            </section>
          );
        })}
      </div>
    </div>
  );
};

export default ELDTimeline;
