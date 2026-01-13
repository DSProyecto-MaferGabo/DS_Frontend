import React, { useState } from 'react';
import notificationsApi from '../../services/notificationsApi';
import { t } from '../../i18n';

export const EmailNotificationsPage = () => {
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const handleSend = async () => {
    setLoading(true);
    setStatus(null);
    setErrorDetail(null);
    // Validación básica
    if (!email.match(/^[^@]+@[^@]+\.[^@]+$/)) {
      setStatus('error');
      setErrorDetail('Formato de email inválido');
      setLoading(false);
      return;
    }
    if (subject.length < 3) {
      setStatus('error');
      setErrorDetail('El asunto debe tener al menos 3 caracteres');
      setLoading(false);
      return;
    }
    if (body.length < 10) {
      setStatus('error');
      setErrorDetail('El mensaje debe tener al menos 10 caracteres');
      setLoading(false);
      return;
    }
    try {
      await notificationsApi.sendGeneralEmail?.({
        to: email,
        subject,
        body,
      });
      setStatus('success');
    } catch (err: any) {
      setStatus('error');
      setErrorDetail(err?.message || 'Error desconocido al enviar el correo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold text-white">{t('email.notificationsTitle')}</h1>
      <div className="flex flex-col gap-2 max-w-lg">
        <input
          className="input input-bordered"
          type="email"
          placeholder={t('email.emailPlaceholder')}
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          className="input input-bordered"
          type="text"
          placeholder={t('email.subjectPlaceholder')}
          value={subject}
          onChange={e => setSubject(e.target.value)}
        />
        <textarea
          className="textarea textarea-bordered"
          rows={4}
          placeholder={t('email.bodyPlaceholder')}
          value={body}
          onChange={e => setBody(e.target.value)}
        />
        <button className="btn btn-primary" onClick={handleSend} disabled={loading || !email || !subject || !body}>
          {loading ? t('email.sending') : t('email.sendNotification')}
        </button>
      </div>
      {status === 'success' && <div className="text-green-400">{t('email.success')}</div>}
      {status === 'error' && (
        <div className="text-red-400">
          {t('email.error')}
          {errorDetail && <div className="text-xs mt-1">{errorDetail}</div>}
        </div>
      )}
    </section>
  );
};

export default EmailNotificationsPage;
