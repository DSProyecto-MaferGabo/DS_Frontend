import React, { useEffect, useMemo, useState } from 'react';
import { EventCard } from '../../components/client/EventCard';
import eventsApi from '../../services/eventsApi';
import recommendationsApi from '../../services/recommendationsApi';
import type { Evento, RecommendedEventScore } from '../../types';
import { useI18n } from '../../i18n';
import { useKeycloak } from '../../hooks/useKeycloak';

export const HomePage = () => {
  const { t } = useI18n();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [recommendedScores, setRecommendedScores] = useState<RecommendedEventScore[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const { authenticated, profile } = useKeycloak();

  useEffect(() => {
    const fetchEventos = async () => {
      try {
        const data = await eventsApi.getEvents();
        // Filter out events that have already finished (date + optional time)
        const now = new Date();
        const upcoming = (data || []).filter((e: any) => {
          // only show to clients when the event is published and not cancelled
          // explicit flags from backend take precedence
          if (e.isPublished === false) return false;
          if (e.isCancelled === true) return false;
          // if isPublished not provided, fall back to inferred flag or state
          const inferred = e.isPublished === true || e._inferredPublished === true;
          if (e.isPublished === null || e.isPublished === undefined) {
            // if neither explicit published nor inferred, treat as not visible
            if (!inferred) return false;
          }
          if (!e || !e.fecha) return false;
          try {
            // Parse fecha (YYYY-MM-DD) and hora (HH:mm:ss) into local Date parts
            const [yStr, mStr, dStr] = String(e.fecha).split('-');
            const year = Number(yStr);
            const month = Number(mStr);
            const day = Number(dStr);
            if (!year || !month || !day) return false;

            // Build date-only and compare with today's local date first
            const eventDateOnly = new Date(year, month - 1, day);
            const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (eventDateOnly < todayDateOnly) return false; // strictly past date
            if (eventDateOnly > todayDateOnly) return true; // future date (regardless of time)

            // If we reach here, the event is scheduled for today -> evaluate time (if present)
            let hour = 0;
            let minute = 0;
            let second = 0;
            if (e.hora) {
              const parts = String(e.hora).split(':').map(p => Number(p));
              if (parts.length >= 1 && !isNaN(parts[0])) hour = parts[0];
              if (parts.length >= 2 && !isNaN(parts[1])) minute = parts[1];
              if (parts.length >= 3 && !isNaN(parts[2])) second = parts[2];
            } else {
              // No hora -> treat as still available today (so set to end of day)
              hour = 23; minute = 59; second = 59;
            }
            const dt = new Date(year, month - 1, day, hour, minute, second);
            if (isNaN(dt.getTime())) return false;
            // Defensive logging: if event date is before today but passes, log details
            if (eventDateOnly < todayDateOnly && dt >= now) {
              console.warn('Event with past date passed the upcoming filter', { evento: e, parsed: dt.toString(), now: now.toString() });
            }
            return dt >= now;
          } catch (err) {
            console.warn('Error parsing event date/time', err, e);
            return false;
          }
        });
        setEventos(upcoming);
        // fetch categories for filter
        try {
          const cats = await eventsApi.getCategories();
          setCategories(cats || []);
        } catch (e) {
          console.warn('Could not load categories for filter', e);
        }
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
        setRecommendedScores(scores || []);
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
      {/* Hero Section */}
      <div className="my-8 text-center bg-base-200 p-10 rounded-lg shadow-2xl bg-cover bg-center" style={{backgroundImage: "linear-gradient(rgba(17, 24, 39, 0.8), rgba(17, 24, 39, 0.8)), url('https://picsum.photos/seed/hero/1200/400')"}}>
        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">{t('home.hero.title')}</h1>
        <p className="text-lg text-gray-300 mb-6 max-w-2xl mx-auto">{t('home.hero.subtitle')}</p>
        <div className="max-w-xl mx-auto">
            <input
                type="text"
                placeholder={t('home.hero.searchPlaceholder')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full p-4 bg-base-100/80 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-lg"
            />
        </div>
      </div>

      {authenticated && (
        <section className="mb-12 bg-base-200 p-6 rounded-lg shadow-inner border border-base-300">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
              <p className="text-primary font-semibold text-sm uppercase tracking-wider">{t('recommendations.forYou')}</p>
              <h2 className="text-2xl font-bold text-white">{t('recommendations.title')}</h2>
              <p className="text-sm text-gray-400">{t('recommendations.subtitle')}</p>
            </div>
            {recommendationsLoading && <span className="text-sm text-gray-400">{t('recommendations.loading')}</span>}
          </div>

          {recommendationsError && (
            <p className="text-sm text-red-400 mb-4">{recommendationsError}</p>
          )}

          {!recommendationsLoading && !recommendationsError && recommendedEventos.length === 0 && (
            <p className="text-sm text-gray-400">{t('recommendations.empty')}</p>
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

      {/* Eventos Destacados Section */}
      <div className="my-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-white border-l-4 border-primary pl-4">{t('home.featured')}</h2>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-300 mr-2">{t('home.filterCategory')}</label>
            <select value={selectedCategory ?? ''} onChange={e => setSelectedCategory(e.target.value ? Number(e.target.value) : null)} className="p-2 bg-base-200 text-sm rounded">
              <option value="">{t('home.allCategories')}</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        {loading && <p className="text-center text-lg">{t('home.loadingEvents')}</p>}
        {error && <p className="text-center text-lg text-red-400">{error}</p>}
        
        {!loading && !error && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {eventos
                .filter(e => {
                  // category filter
                  if (selectedCategory && Number(e.categoryId) !== Number(selectedCategory)) return false;
                  // search filter
                  if (!searchTerm) return true;
                  const q = searchTerm.toLowerCase();
                  return (e.nombre || '').toLowerCase().includes(q) || (e.ubicacion || '').toLowerCase().includes(q) || (e.descripcion || '').toLowerCase().includes(q);
                })
                .map((evento) => (
                  <EventCard key={evento.id} evento={evento} />
              ))}
            </div>
            {eventos.length === 0 && <p className="text-center text-gray-400 mt-4">{t('home.noEvents')}</p>}
          </>
        )}
      </div>
    </div>
  );
};
