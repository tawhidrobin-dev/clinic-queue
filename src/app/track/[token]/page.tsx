'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

interface TrackingData {
  appointment: {
    id: string;
    serialNumber: number;
    appointmentType: string;
    status: string;
    estimatedConsultTime: string | null;
    consultationStartTime: string | null;
    estimatedTravelMins: number | null;
    recommendedLeaveTime: string | null;
    trackingToken: string;
  };
  patient: {
    fullName: string;
    preferredTransport: string | null;
  } | null;
  session: {
    id: string;
    status: string;
    scheduledDate: string;
    scheduledStartTime: string;
    currentServingSerial: number;
  } | null;
  chamber: {
    chamberName: string;
    area: string;
    address: string;
  } | null;
  doctor: {
    fullName: string;
    specialty: string;
  } | null;
  queueMetrics: {
    serialsAhead: number;
    minutesUntilTurn: number | null;
    isCurrentlyServing: boolean;
  };
}

export default function PatientTrackPage() {
  const params = useParams();
  const token = Array.isArray(params?.token) ? params.token[0] : (params?.token as string);

  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/track/${token}`);
      if (!res.ok) {
        throw new Error(`Unable to fetch appointment (HTTP ${res.status})`);
      }
      const json = await res.json();
      setData(json);
      setLastRefreshed(new Date());
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error loading queue status');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
        <p className="mt-4 text-sm text-slate-400">Connecting to clinic live queue...</p>
      </div>
    );
  }

  if (errorMessage || !data) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white text-center">
        <div className="bg-slate-800 border border-slate-700 p-8 rounded-3xl max-w-sm w-full">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-xl font-bold mb-2">Queue Not Found</h2>
          <p className="text-sm text-slate-400">
            {errorMessage || 'Invalid or expired tracking link.'}
          </p>
          <button
            onClick={fetchStatus}
            className="mt-6 px-6 py-2.5 bg-teal-500 hover:bg-teal-600 text-slate-900 font-bold rounded-xl text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const { appointment, patient, session, chamber, doctor, queueMetrics } = data;
  const isCompleted = appointment.status === 'COMPLETED';
  const isInConsultation = appointment.status === 'IN_CONSULTATION';
  const isWaiting = appointment.status === 'WAITING' || appointment.status === 'BOOKED';

  const formattedEstTime = appointment.estimatedConsultTime
    ? new Date(appointment.estimatedConsultTime).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const formattedLeaveTime = appointment.recommendedLeaveTime
    ? new Date(appointment.recommendedLeaveTime).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-4 sm:p-6 pb-20">
      {/* Clinic Header */}
      <div className="w-full max-w-md pt-4 pb-6 flex items-center justify-between border-b border-slate-800">
        <div>
          <h1 className="font-extrabold text-lg text-white tracking-tight">
            {chamber?.chamberName || 'Clinic'}
          </h1>
          <p className="text-xs text-teal-400 font-medium">
            {doctor?.fullName} • {doctor?.specialty}
          </p>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-teal-300 border border-teal-500/30">
            <span className="h-2 w-2 rounded-full bg-teal-400 animate-ping"></span>
            LIVE
          </span>
        </div>
      </div>

      <div className="w-full max-w-md mt-6 space-y-6">
        {/* Main Serial Banner */}
        <div
          className={`rounded-3xl p-6 text-center border relative overflow-hidden transition-all ${
            isInConsultation
              ? 'bg-gradient-to-br from-emerald-600 to-teal-800 border-emerald-400 shadow-xl shadow-emerald-950'
              : isCompleted
              ? 'bg-slate-900 border-slate-800'
              : 'bg-slate-900/90 border-slate-800 shadow-lg'
          }`}
        >
          <p className="text-xs uppercase font-extrabold tracking-wider text-slate-400">
            {patient?.fullName ? `Hello, ${patient.fullName}` : 'Your Queue Status'}
          </p>

          <div className="mt-3 flex items-center justify-center gap-6">
            <div>
              <p className="text-xs text-slate-400 font-medium">Currently Serving</p>
              <p className="text-4xl font-black text-amber-400 mt-1">
                #{session?.currentServingSerial || '—'}
              </p>
            </div>

            <div className="h-10 w-px bg-slate-700"></div>

            <div>
              <p className="text-xs text-slate-400 font-medium">Your Serial</p>
              <p className="text-4xl font-black text-white mt-1">
                #{appointment.serialNumber}
              </p>
            </div>
          </div>

          {/* Status Message */}
          <div className="mt-6 pt-4 border-t border-slate-800/80">
            {isInConsultation ? (
              <div className="text-white font-bold text-lg animate-pulse">
                🔔 IT IS YOUR TURN! Please proceed into doctor room.
              </div>
            ) : isCompleted ? (
              <div className="text-emerald-400 font-bold text-base">
                ✅ Your consultation is completed.
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-slate-300">
                  {queueMetrics.serialsAhead === 0
                    ? 'You are next in line! Get ready.'
                    : `${queueMetrics.serialsAhead} patient(s) ahead of you`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Estimated Turn Time Card (Only for waiting patients) */}
        {isWaiting && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                  Estimated Turn Time
                </p>
                <p className="text-3xl font-extrabold text-teal-400 mt-1">
                  {formattedEstTime || 'Calculating...'}
                </p>
              </div>
              {queueMetrics.minutesUntilTurn !== null && (
                <div className="text-right">
                  <span className="px-3 py-1.5 rounded-xl bg-teal-950 text-teal-300 border border-teal-800 font-bold text-sm inline-block">
                    in ~{queueMetrics.minutesUntilTurn} mins
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-3">
              * Smart moving-average ETA based on current doctor consultation speed.
            </p>
          </div>
        )}

        {/* Travel Intelligence Card */}
        {isWaiting && (appointment.estimatedTravelMins || appointment.recommendedLeaveTime) && (
          <div className="bg-gradient-to-br from-indigo-950/60 to-slate-900 border border-indigo-900/50 rounded-3xl p-6">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm">
              <span>🚗</span> Travel Intelligence
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 text-left">
              {appointment.estimatedTravelMins && (
                <div>
                  <p className="text-xs text-slate-400">Est. Travel Duration</p>
                  <p className="text-lg font-bold text-white">
                    {appointment.estimatedTravelMins} mins
                  </p>
                </div>
              )}

              {formattedLeaveTime && (
                <div>
                  <p className="text-xs text-slate-400">Recommended Leave Time</p>
                  <p className="text-lg font-bold text-amber-300">
                    {formattedLeaveTime}
                  </p>
                </div>
              )}
            </div>

            {patient?.preferredTransport && (
              <p className="text-xs text-indigo-400/80 mt-3">
                Calculated for preferred transport: <strong className="uppercase">{patient.preferredTransport}</strong>
              </p>
            )}
          </div>
        )}

        {/* Queue Progress Steps */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
          <p className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-4">
            Visit Progress
          </p>

          <div className="flex items-center justify-between text-xs font-semibold">
            <div className="flex flex-col items-center gap-1">
              <span className="h-7 w-7 rounded-full bg-teal-500 text-slate-950 font-bold flex items-center justify-center">
                ✓
              </span>
              <span className="text-slate-300">Booked</span>
            </div>

            <div className={`h-1 flex-1 mx-2 rounded ${isWaiting || isInConsultation || isCompleted ? 'bg-teal-500' : 'bg-slate-800'}`}></div>

            <div className="flex flex-col items-center gap-1">
              <span
                className={`h-7 w-7 rounded-full font-bold flex items-center justify-center ${
                  isWaiting
                    ? 'bg-amber-400 text-slate-950 animate-pulse'
                    : isInConsultation || isCompleted
                    ? 'bg-teal-500 text-slate-950'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {isWaiting ? '●' : '✓'}
              </span>
              <span className={isWaiting ? 'text-amber-400 font-bold' : 'text-slate-300'}>Waiting</span>
            </div>

            <div className={`h-1 flex-1 mx-2 rounded ${isInConsultation || isCompleted ? 'bg-teal-500' : 'bg-slate-800'}`}></div>

            <div className="flex flex-col items-center gap-1">
              <span
                className={`h-7 w-7 rounded-full font-bold flex items-center justify-center ${
                  isInConsultation
                    ? 'bg-emerald-400 text-slate-950 animate-bounce'
                    : isCompleted
                    ? 'bg-teal-500 text-slate-950'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {isInConsultation ? '★' : isCompleted ? '✓' : '3'}
              </span>
              <span className={isInConsultation ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                In Room
              </span>
            </div>

            <div className={`h-1 flex-1 mx-2 rounded ${isCompleted ? 'bg-teal-500' : 'bg-slate-800'}`}></div>

            <div className="flex flex-col items-center gap-1">
              <span
                className={`h-7 w-7 rounded-full font-bold flex items-center justify-center ${
                  isCompleted ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 text-slate-500'
                }`}
              >
                {isCompleted ? '✓' : '4'}
              </span>
              <span className={isCompleted ? 'text-teal-400 font-bold' : 'text-slate-500'}>
                Done
              </span>
            </div>
          </div>
        </div>

        {/* Chamber Address Card */}
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 text-xs text-slate-400 space-y-1">
          <p className="font-bold text-slate-300">{chamber?.chamberName}</p>
          <p>{chamber?.address}</p>
          <p className="text-slate-500">Scheduled: {session?.scheduledDate} at {session?.scheduledStartTime}</p>
        </div>

        {/* Auto-update notice */}
        <div className="text-center text-[11px] text-slate-600">
          Auto-refreshing every 15s • Last updated: {lastRefreshed.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
