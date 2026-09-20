'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
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

export default function AssistantDashboardPage() {
  const params = useParams();
  const sessionId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);

  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // File Upload State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  // Doctor Mobile Link
  const [doctorLink, setDoctorLink] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const fetchSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionId) {
      setDoctorLink(`${window.location.origin}/doctor/sessions/${sessionId}`);
    }
  }, [sessionId]);

  const handleCopyDoctorLink = () => {
    if (!doctorLink) return;
    navigator.clipboard.writeText(doctorLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !sessionId) return;

    setUploading(true);
    setUploadSuccess(null);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/upload-appointments`, {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to upload spreadsheet');

      setUploadSuccess(`🎉 ${json.message}`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchSession();
    } catch (err: any) {
      alert(err.message || 'Upload error');
    } finally {
      setUploading(false);
    }
  };

  const handleStartSession = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/start`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to start');
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
      if (!res.ok) throw new Error(json.error || 'Failed to call next');
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
      if (!res.ok) throw new Error(json.error || 'Failed to pause/resume');
      await fetchSession();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
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
    <div className="min-h-screen bg-slate-100 text-slate-800 pb-20">
      {/* Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded-lg bg-teal-100 text-teal-800 text-xs font-black uppercase">
                Assistant Desk
              </span>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                {chamber?.chamberName}
              </h1>
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
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
            <p className="text-xs text-slate-500 mt-1">
              Doctor: <strong className="text-slate-700">{doctor?.fullName}</strong> ({doctor?.specialty}) • {chamber?.area}
            </p>
          </div>

          {/* Quick Desk Controls */}
          <div className="flex items-center gap-2">
            {isScheduled && (
              <button
                onClick={handleStartSession}
                disabled={actionLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow transition disabled:opacity-50"
              >
                ▶ Start Session
              </button>
            )}

            {(isActive || isPaused) && (
              <>
                <button
                  onClick={handlePauseSession}
                  disabled={actionLoading}
                  className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 font-bold text-xs rounded-xl shadow-sm transition"
                >
                  {isPaused ? '▶ Resume' : '⏸ Pause'}
                </button>

                <button
                  onClick={handleNextPatient}
                  disabled={actionLoading || waitingQueue.length === 0}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-xl shadow transition disabled:opacity-50"
                >
                  ⏭ Next Patient
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-6 space-y-6">
        {/* Top 2-Column Row: Step 1 Upload + Step 2 Doctor Mobile Link */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* STEP 1: Excel File Upload Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black uppercase text-teal-600 tracking-wider">Step 1</span>
                <h2 className="text-lg font-bold text-slate-900 mt-0.5">Upload Appointments (Excel / CSV)</h2>
              </div>
              <a
                href={`/api/sessions/${sessionId}/upload-appointments`}
                download
                className="text-xs font-bold text-teal-600 hover:text-teal-800 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200"
              >
                📥 Download Template
              </a>
            </div>

            <p className="text-xs text-slate-500 mt-2">
              Upload your appointment spreadsheet. Columns supported: <code>Serial</code>, <code>Patient Name</code>, <code>Phone Number</code>, <code>Age</code>, <code>Type</code>.
            </p>

            <form onSubmit={handleUploadFile} className="mt-4 space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 border border-slate-200 rounded-xl p-2 bg-slate-50"
              />

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {selectedFile ? `Selected: ${selectedFile.name}` : 'No file chosen'}
                </span>
                <button
                  type="submit"
                  disabled={!selectedFile || uploading}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow transition disabled:opacity-50"
                >
                  {uploading ? 'Processing File...' : 'Upload & Populate Queue'}
                </button>
              </div>
            </form>

            {uploadSuccess && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium">
                {uploadSuccess}
              </div>
            )}
          </div>

          {/* STEP 2: Doctor Mobile Start Link Box */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-teal-400 tracking-wider">Step 2</span>
                <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full">
                  Doctor Action
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1">Doctor Mobile Start Link</h2>
              <p className="text-xs text-slate-400 mt-2">
                Send this 1-click link to the doctor. When the doctor taps their start time on their phone, all waiting patients immediately receive their turn-time SMS alerts.
              </p>

              <div className="mt-4 bg-slate-800/80 p-3 rounded-xl border border-slate-700 flex items-center justify-between">
                <span className="text-xs font-mono text-teal-300 truncate max-w-[280px]">
                  {doctorLink}
                </span>
                <button
                  onClick={handleCopyDoctorLink}
                  className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg text-xs transition"
                >
                  {copiedLink ? 'Copied! ✓' : 'Copy Link'}
                </button>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Scheduled Time: <strong className="text-white">{session.scheduledStartTime}</strong>
              </span>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Hello ${doctor?.fullName || 'Doctor'}, here is your mobile console to start today's clinic queue: ${doctorLink}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
              >
                💬 Send via WhatsApp →
              </a>
            </div>
          </div>
        </div>

        {/* STEP 3: Queue Metrics Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase">Now Inside Room</p>
            <p className="text-3xl font-black text-teal-600 mt-1">
              #{session.currentServingSerial || '—'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {activeConsultation ? activeConsultation.patient?.fullName : 'No patient currently'}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase">Waiting in Queue</p>
            <p className="text-3xl font-black text-indigo-600 mt-1">{waitingQueue.length}</p>
            <p className="text-xs text-slate-500 mt-1">Patients in clinic</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase">Completed Today</p>
            <p className="text-3xl font-black text-emerald-600 mt-1">{completedList.length}</p>
            <p className="text-xs text-slate-500 mt-1">Finished visits</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase">Avg Consult Time</p>
            <p className="text-3xl font-black text-slate-800 mt-1">
              {movingAverageMins} <span className="text-sm font-normal text-slate-500">mins</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">Moving speed</p>
          </div>
        </div>

        {/* STEP 4: Live Queue Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Live Queue Table ({waitingQueue.length} Waiting)
              </h3>
              <p className="text-xs text-slate-400">
                Patient estimated turn times calculate dynamically from doctor's confirmed start time
              </p>
            </div>
            <button
              onClick={fetchSession}
              className="text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700"
            >
              🔄 Refresh List
            </button>
          </div>

          {waitingQueue.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              No appointments in the queue. Upload an Excel file above or wait for doctor to set time.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase font-bold text-slate-400 bg-slate-50">
                  <tr>
                    <th className="py-3 px-3">SL #</th>
                    <th className="py-3 px-3">Patient Name</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Est. Turn Time</th>
                    <th className="py-3 px-3">Live Tracking Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {waitingQueue.map((item) => {
                    const estTime = item.appointment.estimatedConsultTime
                      ? new Date(item.appointment.estimatedConsultTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Awaiting Doctor Start';

                    const trackUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/track/${item.appointment.trackingToken}`;

                    return (
                      <tr key={item.appointment.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 font-extrabold text-teal-600">
                          #{item.appointment.serialNumber}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-800">
                          {item.patient?.fullName}
                          {item.patient?.age && (
                            <span className="text-xs font-normal text-slate-400 ml-1">
                              ({item.patient.age}y)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-xs text-slate-600">
                          {item.patient?.phoneNumber}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                            {item.appointment.appointmentType.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-teal-700">
                          {estTime}
                        </td>
                        <td className="py-3 px-3">
                          <a
                            href={`/track/${item.appointment.trackingToken}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-teal-600 hover:underline inline-flex items-center gap-1"
                          >
                            Open Track ↗
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
