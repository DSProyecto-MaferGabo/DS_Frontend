
import React, { useEffect, useMemo, useState } from 'react';
import { EventCard } from '../components/EventCard';
import api from '../services/api';
import recommendationsApi from '../services/recommendationsApi';
import { useKeycloak } from '../hooks/useKeycloak';
import { useI18n } from '../i18n';
import type { Evento, RecommendedEventScore } from '../types';

export const ClientDashboard = () => {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendedScores, setRecommendedScores] = useState<RecommendedEventScore[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const { authenticated, profile } = useKeycloak();
  const { t } = useI18n();

  useEffect(() => {
    const fetchEventos = async () => {
      try {
        const data = await api.get<Evento[]>('/eventos');
        setEventos(data);
      } catch (err) {
        setError(t('home.errorEvents'));
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchEventos();
  }, []);

  useEffect(() => {
    const userId = profile?.id;
    if (!authenticated || !userId) {
      setRecommendedScores([]);
      setRecommendationsError(null);
      setRecommendationsLoading(false);
      return;
    }

    let isMounted = true;
    setRecommendationsLoading(true);
    recommendationsApi
      .getTopEvents(userId)
      .then((scores) => {
        if (!isMounted) return;
        setRecommendedScores(scores);
        setRecommendationsError(null);
      })
      .catch((err) => {
        console.error('No se pudieron cargar las recomendaciones', err);
        if (!isMounted) return;
        setRecommendationsError(t('recommendations.error') ?? 'No se pudieron cargar tus recomendaciones personalizadas.');
        setRecommendedScores([]);
      })
      .finally(() => {
        if (isMounted) {
          setRecommendationsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [authenticated, profile?.id]);

  const recommendedEventos = useMemo(() => {
    if (!recommendedScores.length || !eventos.length) {
      return [] as { event: Evento; score: number }[];
    }
    const lookup = new Map(eventos.map((evt) => [evt.id, evt]));
    return recommendedScores
      .map((score) => {
        const matched = lookup.get(score.eventId);
        if (!matched) return null;
        return { event: matched, score: score.score };
      })
      .filter((entry): entry is { event: Evento; score: number } => Boolean(entry));
  }, [eventos, recommendedScores]);

  return (
    <div className="container mx-auto px-4">
      <div className="my-8 bg-base-200 p-6 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-white mb-4">{t('home.hero.title')}</h1>
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder={t('home.hero.searchPlaceholder')}
            className="flex-grow p-3 bg-base-300 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <select className="p-3 bg-base-300 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
            <option>{t('home.allCategories')}</option>
            <option>Conciertos</option>
            <option>Conferencias</option>
            <option>Festivales</option>
          </select>
          <button className="bg-primary text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-500 transition-colors">
            {t('home.hero.searchPlaceholder')}
          </button>
        </div>
      </div>

      {authenticated && (
        <section className="mb-10 bg-base-200 p-6 rounded-lg shadow-inner border border-base-300">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
              <p className="text-primary font-semibold text-sm uppercase tracking-wider">{t('recommendations.forYou', { defaultValue: 'Para ti' })}</p>
              <h2 className="text-2xl font-bold text-white">{t('recommendations.title', { defaultValue: 'Recomendaciones Inteligentes' })}</h2>
              <p className="text-sm text-gray-400">{t('recommendations.subtitle', { defaultValue: 'Basadas en tus reservas confirmadas y eventos vistos recientemente.' })}</p>
            </div>
            {recommendationsLoading && <span className="text-sm text-gray-400">{t('recommendations.loading', { defaultValue: 'Calculando...' })}</span>}
          </div>

          {recommendationsError && (
            <p className="text-sm text-red-400 mb-4">{recommendationsError}</p>
          )}

          {!recommendationsLoading && !recommendationsError && recommendedEventos.length === 0 && (
            <p className="text-sm text-gray-400">{t('recommendations.empty', { defaultValue: 'Cuando participes y explores más eventos, mostraremos recomendaciones personalizadas aquí.' })}</p>
          )}

          {recommendedEventos.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {recommendedEventos.map(({ event, score }) => (
                <div key={`recommended-${event.id}`} className="relative">
                  <div className="absolute top-3 left-3 bg-primary text-xs font-bold px-3 py-1 rounded-full shadow-lg uppercase tracking-wide">
                    Score {score}
                  </div>
                  <EventCard evento={event} square />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {loading && <p className="text-center text-lg">Cargando eventos...</p>}
      {error && <p className="text-center text-lg text-red-400">{error}</p>}
      
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {eventos.map((evento) => (
            <EventCard key={evento.id} evento={evento} />
          ))}
        </div>
      )}
    </div>
  );
};
