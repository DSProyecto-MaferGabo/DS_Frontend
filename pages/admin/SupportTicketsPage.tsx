import React, { useEffect, useState } from 'react';
import supportApi, { SupportTicket } from '../../services/supportApi';
import { useKeycloak } from '../../hooks/useKeycloak';
import { Button } from '../../components/ui/Button';
import { useI18n } from '../../i18n';

const statusColors: Record<string, string> = {
  Open: 'bg-yellow-500/20 text-yellow-200',
  InProgress: 'bg-blue-500/20 text-blue-200',
  Closed: 'bg-green-500/20 text-green-200'
};

const SupportTicketsPage: React.FC = () => {
  const { userRecord } = useKeycloak();
  const { t } = useI18n();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionBusy, setActionBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await supportApi.getMyTickets();
      setTickets(data || []);
    } catch (e: any) {
      console.error('No se pudieron cargar tickets', e);
      setError(t('support.admin.error.load'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const updateStatus = async (id: number, status: string, assignSelf: boolean) => {
    setActionBusy(id);
    try {
      await supportApi.updateStatus(id, {
        status,
        supportUserId: assignSelf ? userRecord?.id : undefined
      });
      await loadTickets();
    } catch (e) {
      console.error('No se pudo actualizar el ticket', e);
      setError(t('support.admin.error.update'));
    } finally {
      setActionBusy(null);
    }
  };

  const filtered = tickets.filter(t => statusFilter === 'all' || t.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('support.admin.title')}</h1>
          <p className="text-sm text-gray-400">{t('support.admin.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-base-200 text-gray-200 px-3 py-2 rounded-md border border-base-300"
          >
            <option value="all">{t('support.admin.filter.all')}</option>
            <option value="Open">{t('support.admin.filter.open')}</option>
            <option value="InProgress">{t('support.admin.filter.inProgress')}</option>
            <option value="Closed">{t('support.admin.filter.closed')}</option>
          </select>
          <Button variant="ghost" onClick={loadTickets}>{t('support.admin.refresh')}</Button>
        </div>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}
      {loading ? (
        <div className="text-gray-300">{t('support.admin.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-gray-400">{t('support.admin.empty')}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ticket => (
            <div key={ticket.id} className="bg-base-200 p-4 rounded-lg border border-base-300">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">#{ticket.id}</span>
                  <span className={`px-2 py-1 rounded text-xs ${statusColors[ticket.status] || 'bg-gray-500/20 text-gray-200'}`}>
                    {ticket.status === 'Open'
                      ? t('support.admin.status.open')
                      : ticket.status === 'InProgress'
                        ? t('support.admin.status.inProgress')
                        : ticket.status === 'Closed'
                          ? t('support.admin.status.closed')
                          : ticket.status}
                  </span>
                </div>
                <div className="flex gap-2">
                  {ticket.status !== 'InProgress' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={actionBusy === ticket.id}
                      onClick={() => updateStatus(ticket.id, 'InProgress', true)}
                    >
                      {t('support.admin.action.take')}
                    </Button>
                  )}
                  {ticket.status !== 'Closed' && (
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={actionBusy === ticket.id}
                      onClick={() => updateStatus(ticket.id, 'Closed', false)}
                    >
                      {t('support.admin.action.close')}
                    </Button>
                  )}
                </div>
              </div>
              <div className="font-semibold text-white">{ticket.title}</div>
              <div className="text-sm text-gray-200 whitespace-pre-line">{ticket.description}</div>
              <div className="text-xs text-gray-400 mt-2">
                {t('support.admin.meta.event')}: {ticket.eventId} • {t('support.admin.meta.reporter')}: {ticket.reporterEmail || ticket.reporterUserId} • {t('support.admin.meta.organizer')}: {ticket.organizerEmail || ticket.organizerUserId} • {t('support.admin.meta.support')}: {ticket.supportEmail || t('support.admin.meta.unassigned')}
              </div>
              <div className="text-xs text-gray-500">{t('support.admin.meta.created')}: {new Date(ticket.createdAt).toLocaleString()} • {t('support.admin.meta.updated')}: {new Date(ticket.updatedAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SupportTicketsPage;
