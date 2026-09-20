'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface SessionItem {
  id: string;
  status: string;
  scheduledDate: string;
  scheduledStartTime: string;
  currentServingSerial: number;
}

export default function HomePage() {
  const [sessionsList, setSessionsList] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 sm:p-12">
      <div className="max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="text-center py-8">
          <span className="px-3.5 py-1 rounded-full bg-teal-950 text-teal-400 border border-teal-800 text-xs font-black uppercase tracking-wider">
            Smart Clinic Queue System
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mt-4">
            AI Clinic Queue & Patient Alert Hub
          </h1>
          <p className="text-slate-400 text-base max-w-2xl mx-auto mt-3">
            Doctor sets start time on mobile, appointments imported via Excel, and all patients automatically receive instant SMS turn-time forecasts and live tracking links.
          </p>
        </div>

        {/* 3 Core Roles Launchpad */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {/* 1. Assistant Desk */}
          <div className="bg-slate-900 border border-slate-800 hover:border-teal-500 rounded-3xl p-6 flex flex-col justify-between transition group shadow-xl">
            <div>
              <div className="h-12 w-12 rounded-2xl bg-indigo-950 text-indigo-400 flex items-center justify-center text-2xl mb-4 font-black">
                📋
              </div>
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                For Assistant / Receptionist
              </span>
              <h2 className="text-xl font-bold text-white mt-1 group-hover:text-teal-300 transition">
                Assistant Desk
              </h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Upload appointments from Excel/CSV file, share the mobile start link with the doctor, and run the queue desk.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800">
              <Link
                href="/assistant/sessions/demo"
                className="w-full inline-block py-2.5 px-4 text-center rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow transition"
              >
                Open Assistant Desk →
              </Link>
            </div>
          </div>

          {/* 2. Doctor Mobile Console */}
          <div className="bg-slate-900 border border-slate-800 hover:border-teal-500 rounded-3xl p-6 flex flex-col justify-between transition group shadow-xl">
            <div>
              <div className="h-12 w-12 rounded-2xl bg-teal-950 text-teal-400 flex items-center justify-center text-2xl mb-4 font-black">
                📱
              </div>
              <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">
                For Doctor On Mobile
              </span>
              <h2 className="text-xl font-bold text-white mt-1 group-hover:text-teal-300 transition">
                Doctor Mobile View
              </h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Doctor taps starting time from phone (e.g. &quot;Starting Now&quot; or &quot;6:30 PM&quot;). Triggers instant batch SMS alerts to all queued patients.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800">
              <Link
                href="/doctor/sessions/demo"
                className="w-full inline-block py-2.5 px-4 text-center rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs shadow transition"
              >
                Open Doctor Mobile View →
              </Link>
            </div>
          </div>

          {/* 3. Patient Live Tracker */}
          <div className="bg-slate-900 border border-slate-800 hover:border-teal-500 rounded-3xl p-6 flex flex-col justify-between transition group shadow-xl">
            <div>
              <div className="h-12 w-12 rounded-2xl bg-amber-950 text-amber-400 flex items-center justify-center text-2xl mb-4 font-black">
                🔔
              </div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                For Patient
              </span>
              <h2 className="text-xl font-bold text-white mt-1 group-hover:text-teal-300 transition">
                Patient Live Tracking
              </h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Lightweight web app delivered via SMS link. Shows current serving serial, countdown to turn, and travel intelligence.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800">
              <Link
                href="/track/demo"
                className="w-full inline-block py-2.5 px-4 text-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition"
              >
                Sample Patient View →
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Setup Instructions */}
        <div className="mt-12 bg-slate-900/50 border border-slate-800/80 rounded-3xl p-6 text-xs text-slate-400 space-y-2">
          <p className="font-bold text-slate-200 text-sm">💡 Quick Testing Guide:</p>
          <p>
            1. Run <code className="text-teal-400">npm run db:seed</code> in your terminal to create the test doctor, session, and 4 queued appointments.
          </p>
          <p>
            2. The terminal outputs your active session ID. Visit{' '}
            <code className="text-teal-400">/assistant/sessions/&lt;session-id&gt;</code> to upload new Excel files or manage the queue.
          </p>
          <p>
            3. Open <code className="text-teal-400">/doctor/sessions/&lt;session-id&gt;</code> on your phone to confirm your start time and trigger SMS alerts!
          </p>
        </div>
      </div>

      <footer className="text-center text-xs text-slate-600 pt-8">
        Clinic Queue System • Powered by Next.js, Drizzle ORM, Supabase &amp; Twilio/SSL Wireless
      </footer>
    </div>
  );
}
