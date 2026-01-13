import React, { useState } from 'react';
import notificationsApi from '../../services/notificationsApi';
import { t } from '../../i18n';

export const EventNotificationsPage = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    setLoading(true);
    setStatus(null);
    try {
      await notificationsApi.sendNewEventNotification({
        to: email,
        nombreUsuario: 'Demo User',
        nombreEvento: 'Demo Event',
        fechaEvento: '2026-01-09',
        lugarEvento: 'Demo Venue',
        descripcionEvento: 'Descripción de ejemplo',
        enlaceEvento: 'https://example.com/evento',
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
      <h1 className="text-2xl font-semibold text-white">{t('event.notificationsTitle')}</h1>
      <div className="flex gap-2 items-center">
        <input
          className="input input-bordered"
          type="email"
          placeholder={t('event.emailPlaceholder')}
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <button className="btn btn-primary" onClick={handleSend} disabled={loading || !email}>
          {loading ? t('event.sending') : t('event.sendNotification')}
        </button>
      </div>
      {status === 'success' && <div className="text-green-400">{t('event.success')}</div>}
      {status === 'error' && <div className="text-red-400">{t('event.error')}</div>}
    </section>
  );
};

export default EventNotificationsPage;
