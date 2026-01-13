import React, { useEffect, useState } from 'react';
import notificationsApi from '../../services/notificationsApi';
import { t } from '../../i18n';

export const AdminDashboardPage = () => {
  const [ticketStats, setTicketStats] = useState<any>(null);
  const [eventStats, setEventStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [tickets, events] = await Promise.all([
          notificationsApi.getTicketStats(),
          notificationsApi.getEventStats(),
        ]);
        setTicketStats(tickets);
        setEventStats(events);
      } catch (err) {
        // handle error
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <section className="space-y-8">
      <h1 className="text-3xl font-semibold text-white">{t('admin.dashboardTitle')}</h1>
      {loading ? (
        <div className="text-gray-400">{t('admin.loadingStats')}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-base-200 rounded-xl p-6 border border-base-300 shadow-lg flex flex-col gap-2">
            <span className="text-sm uppercase tracking-wider text-gray-400">Encuestas</span>
            <span className="text-2xl font-bold text-blue-300">{eventStats ? eventStats.surveysResponded + '/' + eventStats.surveysTotal : '--'}</span>
            <a href="/admin/survey-invitations" className="btn btn-xs btn-outline mt-2">Ver invitaciones</a>
          </div>
          <div className="bg-base-200 rounded-xl p-6 border border-base-300 shadow-lg flex flex-col gap-2">
            <span className="text-sm uppercase tracking-wider text-gray-400">Tickets</span>
            <span className="text-2xl font-bold text-emerald-300">{ticketStats ? ticketStats.sent : '--'}</span>
            <a href="/admin/ticket-notifications" className="btn btn-xs btn-outline mt-2">Ver tickets</a>
          </div>
          <div className="bg-base-200 rounded-xl p-6 border border-base-300 shadow-lg flex flex-col gap-2">
            <span className="text-sm uppercase tracking-wider text-gray-400">Emails</span>
            <span className="text-2xl font-bold text-yellow-300">{eventStats ? eventStats.emailsSent : '--'}</span>
            <a href="/admin/email-notifications" className="btn btn-xs btn-outline mt-2">Ver emails</a>
          </div>
          <div className="bg-base-200 rounded-xl p-6 border border-base-300 shadow-lg flex flex-col gap-2">
            <span className="text-sm uppercase tracking-wider text-gray-400">Eventos</span>
            <span className="text-2xl font-bold text-green-300">{eventStats ? eventStats.eventsPublished : '--'}</span>
            <a href="/admin/eventos" className="btn btn-xs btn-outline mt-2">Ver eventos</a>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminDashboardPage;
