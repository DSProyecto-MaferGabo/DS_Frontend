import React, { useState } from 'react';
import notificationsApi from '../../services/notificationsApi';
import { t } from '../../i18n';

export const TicketNotificationsPage = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    setLoading(true);
    setStatus(null);
    try {
      await notificationsApi.sendTicketConfirmation({
        to: email,
        nombreUsuario: 'Demo User',
        nombreEvento: 'Demo Event',
        fechaEvento: '2026-01-09',
        lugarEvento: 'Demo Venue',
        cantidadEntradas: 2,
        asientos: 'A1, A2',
        montoTotal: '100.00',
        codigoCompra: 'ABC123',
      });
      setStatus('success');
    } catch {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold text-white">{t('ticket.notificationsTitle')}</h1>
      <div className="flex gap-2 items-center">
        <input
          className="input input-bordered"
          type="email"
          placeholder={t('ticket.emailPlaceholder')}
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <button className="btn btn-primary" onClick={handleSend} disabled={loading || !email}>
          {loading ? t('ticket.sending') : t('ticket.sendNotification')}
        </button>
      </div>
      {status === 'success' && <div className="text-green-400">{t('ticket.success')}</div>}
      {status === 'error' && <div className="text-red-400">{t('ticket.error')}</div>}
    </section>
  );
};

export default TicketNotificationsPage;
