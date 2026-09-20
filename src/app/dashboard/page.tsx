'use client';

import React, { useState, useEffect } from 'react';
import { calculateQueueEstimates, QueueItem } from '../../lib/queue-engine';
import { Play, CheckCircle, UserX, Users } from 'lucide-react';

const initialQueue: QueueItem[] = [
  { id: '1', tokenNumber: 101, patientName: 'Rahim Uddin', visitType: 'NEW', status: 'IN_CONSULTATION' },
  { id: '2', tokenNumber: 102, patientName: 'Taznin Sultana', visitType: 'FOLLOW_UP', status: 'WAITING' },
  { id: '3', tokenNumber: 103, patientName: 'Anwar Hossain', visitType: 'REPORT', status: 'WAITING' },
  { id: '4', tokenNumber: 104, patientName: 'Nusrat Jahan', visitType: 'NEW', status: 'WAITING' },
  { id: '5', tokenNumber: 105, patientName: 'Kamal Pasha', visitType: 'FOLLOW_UP', status: 'WAITING' },
];

export default function DashboardPage() {
  const [queue, setQueue] = useState<QueueItem[]>(initialQueue);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const updatedQueue = calculateQueueEstimates(queue);

  const updateStatus = (id: string, newStatus: QueueItem['status']) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
    );
  };

  const activePatient = queue.find((p) => p.status === 'IN_CONSULTATION');
  const waitingCount = queue.filter((p) => p.status === 'WAITING').length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Bar */}
        <header className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-emerald-400">DocAssist — Control Center</h1>
            <p className="text-sm text-slate-400">Chamber Queue Management & Dynamic Recalibration</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span className="text-sm">Waiting: <strong>{waitingCount}</strong></span>
            </div>
          </div>
        </header>

        {/* Active Patient Card */}
        <section className="bg-slate-800/80 rounded-xl p-6 border border-emerald-500/30 shadow-lg">
          <h2 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Current Active Patient</h2>
          {activePatient ? (
            <div className="flex justify-between items-center">
              <div>
                <span className="text-4xl font-black text-white mr-4">#{activePatient.tokenNumber}</span>
                <span className="text-2xl font-medium text-slate-200">{activePatient.patientName}</span>
                <span className="ml-3 px-2.5 py-1 text-xs font-semibold rounded bg-slate-700 text-emerald-300">
                  {activePatient.visitType}
                </span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => updateStatus(activePatient.id, 'COMPLETED')}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium transition"
                >
                  <CheckCircle className="w-4 h-4" /> Complete Consultation
                </button>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 italic">No consultation currently in progress.</p>
          )}
        </section>

        {/* Live Queue Table */}
        <section className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700 font-semibold text-slate-300">Session Queue</div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase border-b border-slate-700">
              <tr>
                <th className="p-4">Token</th>
                <th className="p-4">Patient Name</th>
                <th className="p-4">Type</th>
                <th className="p-4">Est. Turn</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {updatedQueue.map((item) => (
                <tr key={item.id} className="hover:bg-slate-700/30 transition">
                  <td className="p-4 font-bold text-slate-200">#{item.tokenNumber}</td>
                  <td className="p-4 font-medium text-slate-100">{item.patientName}</td>
                  <td className="p-4 text-xs text-slate-400">{item.visitType}</td>
                  <td className="p-4 text-emerald-400 font-mono">
                    {isMounted ? item.estimatedTime : '--:--'}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      item.status === 'IN_CONSULTATION' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      item.status === 'COMPLETED' ? 'bg-slate-700 text-slate-400' :
                      'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    {item.status === 'WAITING' && (
                      <button
                        onClick={() => updateStatus(item.id, 'IN_CONSULTATION')}
                        className="p-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded transition"
                        title="Call Next"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    {item.status !== 'COMPLETED' && (
                      <button
                        onClick={() => updateStatus(item.id, 'NO_SHOW')}
                        className="p-1.5 bg-rose-500/20 text-rose-400 hover:bg-rose-600 hover:text-white rounded transition"
                        title="Mark No-Show"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

      </div>
    </div>
  );
}