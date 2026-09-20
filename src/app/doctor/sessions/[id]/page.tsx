'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

interface SessionDetails {
  session: {
    id: string;
    status: string;
    scheduledDate: string;
    scheduledStartTime: string;
    currentServingSerial: number;
    actualStartTime: string | null;
  };
  chamber: {
    chamberName: string;
    area: string;
  } | null;
  doctor: {
    fullName: string;
    specialty: string;
  } | null;
  activeConsultation: {
    appointment: {
      serialNumber: number;
      appointmentType: string;
    };
    patient: {
      fullName: string;
    } | null;
  } | null;
  waitingQueue: Array<{
    appointment: {
      id: string;
      serialNumber: number;
      appointmentType: string;
      estimatedConsultTime: string | null;
    };
    patient: {
      fullName: string;
    } | null;
  }>;
}

export default function DoctorMobilePage() {
  const params = useParams();
  const sessionId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);

  const [data, setData] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Doctor Time Selection State
  const [selectedTimeMode, setSelectedTimeMode] = useState<'NOW' | 'DELAY' | 'CUSTOM'>('NOW');
  const [delayMins, setDelayMins] = useState<number>(15);
  const [customTime, setCustomTime] = useState<string>('18:00');

  const fetchSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) throw new Error('Failed to load session');
      const json = await res.json();
      setData(json);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error loading session');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 10000);
    return () => clearInterval(interval);
  }, [fetchSession]);

  const handleConfirmStartTime = async () => {
    setSubmitting(true);
    setSuccessNotice(null);
    try {
      const payload: any = {};

      if (selectedTimeMode === 'NOW') {
        payload.isStartingNow = true;
      } else if (selectedTimeMode === 'DELAY') {
        payload.isStartingNow = true;
        payload.delayMinutes = delayMins;
      } else {
        payload.startTime = customTime;
      }

      const res = await fetch(`/api/sessions/${sessionId}/set-start-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to submit start time');

      setSuccessNotice(json.message || 'Start time confirmed and SMS sent!');
      await fetchSession();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNextPatient = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/next-patient`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to call next patient');
      await fetchSession();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePause = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/pause`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to pause/resume');
      await fetchSession();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-400"></div>
      </div>
    );
  }

  if (errorMessage || !data) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 max-w-sm w-full">
          <h2 className="text-lg font-bold text-red-400">Session Error</h2>
          <p className="text-sm text-slate-300 mt-2">{errorMessage || 'Session not found'}</p>
          <button
            onClick={fetchSession}
            className="mt-4 px-4 py-2 bg-teal-500 text-slate-900 font-bold rounded-xl text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { session, chamber, doctor, activeConsultation, waitingQueue } = data;
  const isPaused = session.status === 'PAUSED';
  const isActive = session.status === 'ACTIVE';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-4 pb-20">
      {/* Mobile Top Header */}
      <div className="w-full max-w-md pt-2 pb-4 flex items-center justify-between border-b border-slate-800">
        <div>
          <span className="text-[10px] font-bold tracking-wider uppercase text-teal-400">
            Doctor Mobile Console
          </span>
          <h1 className="font-extrabold text-base text-white">
            {doctor?.fullName || 'Doctor'}
          </h1>
          <p className="text-xs text-slate-400">
            {chamber?.chamberName} ({chamber?.area})
          </p>
        </div>

        <span
          className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
            isActive
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
              : isPaused
              ? 'bg-amber-950 text-amber-300 border border-amber-700'
              : 'bg-slate-800 text-slate-400'
          }`}
        >
          {session.status}
        </span>
      </div>

      <div className="w-full max-w-md mt-5 space-y-5">
        {/* Success Alert Banner */}
        {successNotice && (
          <div className="bg-emerald-950/80 border border-emerald-500/50 p-4 rounded-2xl text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <span>✅</span>
            <span>{successNotice}</span>
          </div>
        )}

        {/* SECTION 1: Starting Time Input (The Core Feature) */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-sm uppercase tracking-wide text-teal-400">
              Set Your Starting Time
            </h2>
            <span className="text-xs text-slate-400">
              {waitingQueue.length} patient(s) waiting
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Setting your time instantly sends an SMS with exact estimated turn times to all patients.
          </p>

          {/* Quick Presets */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <button
              onClick={() => setSelectedTimeMode('NOW')}
              className={`py-3 px-2 rounded-2xl font-bold text-xs text-center border transition ${
                selectedTimeMode === 'NOW'
                  ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-md shadow-teal-950'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700'
              }`}
            >
              ⚡ Starting Now
            </button>

            <button
              onClick={() => {
                setSelectedTimeMode('DELAY');
                setDelayMins(15);
              }}
              className={`py-3 px-2 rounded-2xl font-bold text-xs text-center border transition ${
                selectedTimeMode === 'DELAY' && delayMins === 15
                  ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-md shadow-teal-950'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700'
              }`}
            >
              ⏱ In 15 Mins
            </button>

            <button
              onClick={() => {
                setSelectedTimeMode('DELAY');
                setDelayMins(30);
              }}
              className={`py-3 px-2 rounded-2xl font-bold text-xs text-center border transition ${
                selectedTimeMode === 'DELAY' && delayMins === 30
                  ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-md shadow-teal-950'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700'
              }`}
            >
              ⏱ In 30 Mins
            </button>
          </div>

          {/* Custom Time Option */}
          <div className="mt-3">
            <button
              onClick={() => setSelectedTimeMode('CUSTOM')}
              className={`w-full py-2.5 px-3 rounded-2xl font-semibold text-xs flex items-center justify-between border transition ${
                selectedTimeMode === 'CUSTOM'
                  ? 'bg-slate-800 text-white border-teal-500'
                  : 'bg-slate-800/50 text-slate-400 border-slate-800'
              }`}
            >
              <span>🕒 Choose Specific Clock Time:</span>
              <input
                type="time"
                value={customTime}
                onChange={(e) => {
                  setCustomTime(e.target.value);
                  setSelectedTimeMode('CUSTOM');
                }}
                className="bg-slate-950 text-teal-400 font-bold px-2 py-1 rounded-lg border border-slate-700 text-xs"
              />
            </button>
          </div>

          {/* Big Action Button */}
          <button
            onClick={handleConfirmStartTime}
            disabled={submitting || waitingQueue.length === 0}
            className="w-full mt-4 py-3.5 px-4 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-black rounded-2xl shadow-lg transition text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? 'Calculating & Sending SMS...' : '🚀 Confirm Time & Send Patient SMS'}
          </button>
        </div>

        {/* SECTION 2: Active Patient & Queue Controls */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-extrabold text-slate-400">Current In Room</span>
            <span className="text-xs font-bold text-amber-400">
              Serial #{session.currentServingSerial || '—'}
            </span>
          </div>

          {activeConsultation ? (
            <div className="mt-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div className="flex items-baseline justify-between">
                <p className="text-xl font-black text-white">
                  Serial #{activeConsultation.appointment.serialNumber}
                </p>
                <span className="text-[10px] px-2 py-0.5 rounded bg-teal-950 text-teal-300 font-bold">
                  {activeConsultation.appointment.appointmentType.replace('_', ' ')}
                </span>
              </div>
              <p className="text-sm font-bold text-slate-300 mt-1">
                {activeConsultation.patient?.fullName || 'Patient'}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500 mt-3 text-center py-2">
              No patient currently in consultation.
            </p>
          )}

          {/* In-Room Action Buttons */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              onClick={handleTogglePause}
              disabled={submitting}
              className={`py-3 px-3 rounded-2xl font-bold text-xs border transition ${
                isPaused
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : 'bg-amber-950 text-amber-300 border-amber-800'
              }`}
            >
              {isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>

            <button
              onClick={handleNextPatient}
              disabled={submitting || waitingQueue.length === 0}
              className="py-3 px-3 bg-teal-500 hover:bg-teal-600 text-slate-950 font-black rounded-2xl shadow text-xs transition disabled:opacity-50"
            >
              ⏭ Next Patient
            </button>
          </div>
        </div>

        {/* SECTION 3: Waiting Queue Glance */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Queue Preview ({waitingQueue.length})
            </h3>
            <span className="text-[11px] text-teal-400">Scheduled Today</span>
          </div>

          {waitingQueue.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No patients waiting in queue.</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {waitingQueue.map((item) => {
                const estTime = item.appointment.estimatedConsultTime
                  ? new Date(item.appointment.estimatedConsultTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Pending';

                return (
                  <div
                    key={item.appointment.id}
                    className="flex items-center justify-between bg-slate-950 px-3 py-2.5 rounded-xl border border-slate-800/80 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-black text-teal-400">
                        #{item.appointment.serialNumber}
                      </span>
                      <span className="font-semibold text-slate-300">
                        {item.patient?.fullName || 'Patient'}
                      </span>
                    </div>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {estTime}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
