'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

interface SessionData {
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
    address: string;
  } | null;
  doctor: {
    fullName: string;
    specialty: string;
    avgConsultationMins: number;
  } | null;
  movingAverageMins: number;
  activeConsultation: {
    appointment: {
      id: string;
      serialNumber: number;
      appointmentType: string;
      consultationStartTime: string;
    };
    patient: {
      fullName: string;
      phoneNumber: string;
      age: number | null;
      gender: string | null;
    } | null;
  } | null;
  waitingQueue: Array<{
    appointment: {
      id: string;
      serialNumber: number;
      appointmentType: string;
      status: string;
      estimatedConsultTime: string | null;
      trackingToken: string;
    };
    patient: {
      fullName: string;
      phoneNumber: string;
      age: number | null;
    } | null;
  }>;
  completedList: Array<{
    appointment: {
      id: string;
      serialNumber: number;
      actualDurationMins: number | null;
      consultationEndTime: string | null;
    };
    patient: {
      fullName: string;
    } | null;
  }>;
}

export default function DoctorControlCenterPage() {
  const params = useParams();
  const sessionId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);

  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedMins, setElapsedMins] = useState<number>(0);

  const fetchSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) {
        throw new Error(`Failed to load session (HTTP ${res.status})`);
      }
      const json = await res.json();
      setData(json);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error fetching session data');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [fetchSession]);

  // Live timer for active consultation
  useEffect(() => {
    if (!data?.activeConsultation?.appointment?.consultationStartTime) {
      setElapsedMins(0);
      return;
    }
    const updateElapsed = () => {
      const start = new Date(data.activeConsultation!.appointment.consultationStartTime).getTime();
      const diff = Math.max(0, Math.floor((Date.now() - start) / 60000));
      setElapsedMins(diff);
    };
    updateElapsed();
    const timer = setInterval(updateElapsed, 15000);
    return () => clearInterval(timer);
  }, [data?.activeConsultation]);

  const handleStartSession = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/start`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to start session');
      await fetchSession();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleNextPatient = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/next-patient`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to advance queue');
      await fetchSession();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePauseSession = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/pause`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to toggle pause');
      await fetchSession();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (errorMessage || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-red-50 text-red-700 border border-red-200 p-6 rounded-2xl max-w-md w-full">
          <h2 className="text-xl font-bold mb-2">Session Load Error</h2>
          <p className="text-sm">{errorMessage || 'Session not found'}</p>
          <button
            onClick={fetchSession}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { session, chamber, doctor, activeConsultation, waitingQueue, completedList, movingAverageMins } = data;
  const isScheduled = session.status === 'SCHEDULED';
  const isActive = session.status === 'ACTIVE';
  const isPaused = session.status === 'PAUSED';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 pb-16">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                Doctor Control Center
              </h1>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isActive
                    ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                    : isPaused
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {session.status}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              <span className="font-semibold text-slate-700">{doctor?.fullName || 'Dr. Specialist'}</span> ({doctor?.specialty}) •{' '}
              {chamber?.chamberName} ({chamber?.area})
            </p>
          </div>

          {/* Quick Action Controls */}
          <div className="flex items-center gap-2">
            {isScheduled && (
              <button
                onClick={handleStartSession}
                disabled={actionLoading}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2"
              >
                ▶ Start Session
              </button>
            )}

            {(isActive || isPaused) && (
              <>
                <button
                  onClick={handlePauseSession}
                  disabled={actionLoading}
                  className={`px-4 py-2.5 font-bold rounded-xl border text-sm transition disabled:opacity-50 ${
                    isPaused
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  {isPaused ? '▶ Resume Session' : '⏸ Pause'}
                </button>

                <button
                  onClick={handleNextPatient}
                  disabled={actionLoading}
                  className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2"
                >
                  ⏭ Next Patient
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Metrics & Active Patient (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Key Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Currently Serving</p>
              <p className="text-4xl font-extrabold text-teal-600 mt-2">
                #{session.currentServingSerial || '—'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Serial Number</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">In Waiting Queue</p>
              <p className="text-4xl font-extrabold text-indigo-600 mt-2">
                {waitingQueue.length}
              </p>
              <p className="text-xs text-slate-500 mt-1">Patients Waiting</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Consult Speed</p>
              <p className="text-4xl font-extrabold text-slate-800 mt-2">
                {movingAverageMins} <span className="text-lg font-normal text-slate-500">mins</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">Moving Average</p>
            </div>
          </div>

          {/* Currently In Consultation Card */}
          <div className="bg-white rounded-2xl border-2 border-teal-500 p-6 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-teal-500 text-white px-4 py-1 text-xs font-black uppercase tracking-widest rounded-bl-xl">
              Now Inside Room
            </div>

            {activeConsultation ? (
              <div>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-black text-slate-900">
                    Serial #{activeConsultation.appointment.serialNumber}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800">
                    {activeConsultation.appointment.appointmentType?.replace('_', ' ')}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs uppercase font-bold">Patient Name</p>
                    <p className="font-bold text-slate-800 text-lg">
                      {activeConsultation.patient?.fullName || 'Anonymous Patient'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs uppercase font-bold">Phone & Demographics</p>
                    <p className="font-medium text-slate-700">
                      {activeConsultation.patient?.phoneNumber} • {activeConsultation.patient?.age ? `${activeConsultation.patient.age}y` : 'Age N/A'} (
                      {activeConsultation.patient?.gender || 'N/A'})
                    </p>
                  </div>
                </div>

                {/* Consultation Live Timer */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-emerald-500 animate-ping"></span>
                    <span className="text-sm font-semibold text-slate-600">
                      Time Elapsed: <strong className="text-slate-900">{elapsedMins} mins</strong>
                    </span>
                  </div>
                  <button
                    onClick={handleNextPatient}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold shadow transition"
                  >
                    Finish & Call Next →
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-400 font-medium">No patient currently inside consultation.</p>
                {waitingQueue.length > 0 && (
                  <button
                    onClick={handleNextPatient}
                    disabled={actionLoading}
                    className="mt-4 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow text-sm"
                  >
                    Call Serial #{waitingQueue[0].appointment.serialNumber}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Waiting Queue Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                Waiting List ({waitingQueue.length})
              </h3>
              <span className="text-xs text-slate-400">Times auto-recalculate on patient finish</span>
            </div>

            {waitingQueue.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">No patients waiting in queue.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase font-bold text-slate-400 bg-slate-50">
                    <tr>
                      <th className="py-3 px-3">Serial</th>
                      <th className="py-3 px-3">Patient</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Est. Turn Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {waitingQueue.map((item) => {
                      const estTime = item.appointment.estimatedConsultTime
                        ? new Date(item.appointment.estimatedConsultTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Calculating...';

                      return (
                        <tr key={item.appointment.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-3 font-extrabold text-teal-600">
                            #{item.appointment.serialNumber}
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-800">
                            {item.patient?.fullName || 'Patient'}
                            <span className="block text-xs text-slate-400">{item.patient?.phoneNumber}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600">
                              {item.appointment.appointmentType?.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                              {item.appointment.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-700">
                            {estTime}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Recent Completed Patients (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Completed Today</h3>

            {completedList.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">No completed consultations yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {completedList.map((c) => (
                  <li key={c.appointment.id} className="py-3 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800">Serial #{c.appointment.serialNumber}</span>
                      <p className="text-xs text-slate-400">{c.patient?.fullName || 'Patient'}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {c.appointment.actualDurationMins ? `${c.appointment.actualDurationMins} mins` : '—'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm text-xs space-y-2">
            <p className="font-bold text-teal-400 uppercase tracking-wider">Live Travel & SMS Engine</p>
            <p className="text-slate-300">
              When consultation times adjust by &gt;15 mins, automated SMS notifications are dispatched to waiting patients with live tracking links.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
