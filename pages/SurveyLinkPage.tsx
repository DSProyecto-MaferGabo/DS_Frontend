import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import keycloak from '../services/keycloakService';

const API_BASE = import.meta.env.VITE_SURVEYS_API_URL || 'http://localhost:5206/api';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const SurveyLinkPage: React.FC = () => {
  const query = useQuery();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<any>(null);
  const [survey, setSurvey] = useState<any>(null);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    const token = query.get('token');
    if (!token) {
      setError('Enlace inválido.');
      setLoading(false);
      return;
    }
    fetch(`${API_BASE}/events/survey-invitations/validate-link?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then(({ invitation, survey }) => {
        setInvitation(invitation);
        setSurvey(survey);
        setLoading(false);
        // Si no está autenticado, forzar login y redirigir de vuelta
        if (!keycloak.authenticated) {
          keycloak.login(false, window.location.href);
        }
      })
      .catch((err) => {
        setError(typeof err === 'string' ? err : err.message || 'Error al validar el enlace.');
        setLoading(false);
      });
  }, [query]);

  if (loading) return <div className="p-8 text-center text-gray-400">Cargando encuesta...</div>;
  if (error) return <div className="p-8 text-center text-red-400">{error}</div>;
  if (!invitation || !survey) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!score) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/surveys/${invitation.SurveyId}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitationToken: query.get('token'),
          score,
          comment,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSubmitSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Error al enviar la respuesta.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitSuccess) {
    return (
      <div className="max-w-xl mx-auto p-8 bg-base-200 rounded-lg mt-8 text-center">
        <h2 className="text-2xl font-bold mb-4 text-green-400">¡Gracias por tu respuesta!</h2>
        <p className="text-gray-300">Tu opinión nos ayuda a mejorar los eventos.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-base-200 rounded-lg mt-8">
      <h1 className="text-2xl font-bold mb-2">{survey.title || 'Encuesta de satisfacción'}</h1>
      <p className="mb-4 text-gray-400">{survey.description || 'Ayúdanos calificando el evento y contándonos tu experiencia.'}</p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-lg mb-2 text-white">¿Qué puntaje le das al evento?</label>
          <div className="flex gap-3 mt-2">
            {[1,2,3,4,5].map((n) => (
              <button
                type="button"
                key={n}
                className={`w-12 h-12 rounded-full border-2 text-xl font-bold ${score === n ? 'bg-blue-500 border-blue-700 text-white' : 'bg-base-100 border-gray-500 text-gray-300'}`}
                onClick={() => setScore(n)}
                disabled={submitting}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-lg mb-2 text-white">Cuéntanos de tu experiencia o ¿qué mejorarías?</label>
          <textarea
            className="textarea textarea-bordered w-full min-h-[100px]"
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Tu opinión..."
            disabled={submitting}
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={submitting || !score}
        >
          {submitting ? 'Enviando...' : 'Enviar respuesta'}
        </button>
      </form>
    </div>
  );
};

export default SurveyLinkPage;
