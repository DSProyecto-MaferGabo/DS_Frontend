import React, { useEffect, useMemo, useRef, useState } from 'react';
import forumsApi, { ForumTopic, ForumPost } from '../../services/forumsApi';
import eventsApi from '../../services/eventsApi';
import {
  joinForumChannel,
  leaveForumChannel,
  registerForumPostHandler,
  type ForumPostPayload,
} from '../../services/notificationHubClient';
import { Button } from '../../components/ui/Button';
import { useKeycloak } from '../../hooks/useKeycloak';

interface LiveEntry extends ForumPostPayload {
  receivedAt: string;
}

const formatDate = (value?: string) => {
  if (!value) return 'Sin fecha';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  } catch {
    return value;
  }
};

export const ForumMonitorPage: React.FC = () => {
  const { profile, keycloakInstance } = useKeycloak();
  const isAdmin = keycloakInstance?.hasRealmRole('administrador') || keycloakInstance?.hasRealmRole('admin');
  const [forums, setForums] = useState<ForumTopic[]>([]);
  const [selectedForumId, setSelectedForumId] = useState<number | null>(null);
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
  const [myEvents, setMyEvents] = useState<any[]>([]);
  const [liveFeed, setLiveFeed] = useState<LiveEntry[]>([]);
  const [loadingForums, setLoadingForums] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newForumTitle, setNewForumTitle] = useState('');
  const [newForumDescription, setNewForumDescription] = useState('');
  const [newForumEventId, setNewForumEventId] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [creatingForum, setCreatingForum] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoadingForums(true);

    (async () => {
      try {
        let forumList: ForumTopic[] = [];

        if (isAdmin) {
          // Admin sees all forums
          forumList = await forumsApi.getForums();
        } else {
          // Organizer sees only forums from their events
          const myEvents = await eventsApi.getMyEvents();
          setMyEvents(myEvents || []);
          if (!newForumEventId && myEvents && myEvents.length > 0) {
            setNewForumEventId(myEvents[0].id);
          }
          const eventIds = (myEvents || []).map((e: any) => e.id).filter(Boolean);

          // Get forums for each event
          const forumPromises = eventIds.map(eventId => forumsApi.getForumsByEvent(eventId));
          const forumArrays = await Promise.all(forumPromises);

          // Flatten and deduplicate forums
          const allForums = forumArrays.flat();
          const uniqueForums = allForums.filter((forum, index, self) =>
            index === self.findIndex(f => f.id === forum.id)
          );

          forumList = uniqueForums;
        }

        if (!mounted) return;
        setForums(forumList);
        if (!selectedForumId && forumList.length > 0) {
          setSelectedForumId(forumList[0].id);
        }
      } catch (err) {
        console.error('No se pudieron cargar los foros', err);
      } finally {
        if (mounted) setLoadingForums(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedForumId, isAdmin]);

  useEffect(() => {
    if (!selectedForumId) return;
    let mounted = true;
    setLoadingPosts(true);
    forumsApi.getForumPosts(selectedForumId)
      .then(posts => {
        if (!mounted) return;
        const ordered = [...posts].sort((a, b) => {
          const aTime = new Date(a.datePosted ?? '').getTime();
          const bTime = new Date(b.datePosted ?? '').getTime();
          return bTime - aTime;
        });
        setForumPosts(ordered);
      })
      .catch(err => console.error('No se pudieron cargar las publicaciones', err))
      .finally(() => {
        if (mounted) setLoadingPosts(false);
      });

    return () => {
      mounted = false;
    };
  }, [selectedForumId]);

  useEffect(() => {
    if (!selectedForumId) return;
    let disposed = false;
    setSubscribing(true);

    (async () => {
      try {
        await joinForumChannel(selectedForumId);
        const unsubscribe = await registerForumPostHandler((payload) => {
          if (disposed || !payload) return;
          const payloadTopic = (payload.topicId ?? (payload as any).TopicId ?? '').toString();
          if (payloadTopic !== selectedForumId.toString()) return;
          const receivedAt = new Date().toISOString();
          setLiveFeed(prev => [{ ...payload, receivedAt }, ...prev].slice(0, 30));
          if (payload.content) {
            setForumPosts(prev => [
              {
                id: Number(payload.postId ?? Date.now()),
                forumId: selectedForumId,
                userId: payload.author ?? 'desconocido',
                content: payload.content ?? '',
                datePosted: receivedAt,
                status: 'Publicado',
              },
              ...prev,
            ]);
          }
        });
        unsubscribeRef.current = unsubscribe;
      } catch (err) {
        console.warn('No se pudo suscribir al canal del foro', err);
      } finally {
        if (!disposed) setSubscribing(false);
      }
    })();

    return () => {
      disposed = true;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      leaveForumChannel(selectedForumId).catch(() => {});
    };
  }, [selectedForumId]);

  const selectedForum = useMemo(
    () => forums.find(f => f.id === selectedForumId) ?? null,
    [forums, selectedForumId]
  );

  const handleCreateForum = async () => {
    if (!newForumEventId || !newForumTitle.trim()) {
      alert('Selecciona un evento y coloca un título para el foro.');
      return;
    }
    setCreatingForum(true);
    try {
      await forumsApi.createForum({
        eventId: newForumEventId,
        title: newForumTitle.trim(),
        description: newForumDescription.trim(),
      });
      setNewForumTitle('');
      setNewForumDescription('');
      const refreshed = isAdmin ? await forumsApi.getForums() : await forumsApi.getForumsByEvent(newForumEventId);
      const merged = isAdmin ? refreshed : [...forums, ...refreshed].filter((f, idx, self) => idx === self.findIndex(ff => ff.id === f.id));
      setForums(merged);
      if (!selectedForumId && merged.length > 0) setSelectedForumId(merged[0].id);
      alert('Foro creado correctamente.');
    } catch (err) {
      console.error('No se pudo crear el foro', err);
      alert('No se pudo crear el foro.');
    } finally {
      setCreatingForum(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedForumId || !newMessage.trim()) {
      alert('Selecciona un foro e ingresa un mensaje.');
      return;
    }

    const forumEvent = forums.find(f => f.id === selectedForumId)?.eventId;
    if (!forumEvent) {
      alert('El foro seleccionado no está ligado a un evento válido.');
      return;
    }

    setPublishing(true);
    try {
      await forumsApi.createPost({
        forumId: selectedForumId,
        eventId: forumEvent,
        title: newTitle.trim() || `Actualización ${new Date().toLocaleString()}`,
        content: newMessage.trim(),
        userId: profile?.id ?? 'frontend-user',
      });
      setNewTitle('');
      setNewMessage('');
    } catch (err) {
      console.error('Error publicando en el foro', err);
      alert('No se pudo publicar tu mensaje.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Centro de Foros en Tiempo Real</h1>
        <p className="text-gray-300 max-w-3xl">
          Supervisa la conversación de cada evento. Al seleccionar un foro nos unimos automáticamente al canal SignalR
          y mostramos cualquier mensaje emitido a través del NotificationHub.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="bg-base-200/60 rounded-xl p-4 border border-base-300 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">Foros activos</h2>
            {loadingForums && <span className="text-sm text-gray-400">Cargando...</span>}
          </div>
          {!isAdmin && (
            <div className="mb-4 space-y-2 bg-base-100/60 border border-dashed border-base-300 p-3 rounded-lg">
              <div className="text-sm text-gray-300 font-semibold">Crear nuevo foro</div>
              <select
                className="select select-bordered w-full bg-base-100"
                value={newForumEventId ?? ''}
                onChange={(e) => setNewForumEventId(Number(e.target.value))}
              >
                <option value="" disabled>Selecciona un evento</option>
                {myEvents.map(evt => (
                  <option key={evt.id} value={evt.id}>{evt.nombre} · {evt.fecha}</option>
                ))}
              </select>
              <input
                className="input input-bordered w-full bg-base-100"
                placeholder="Título del foro"
                value={newForumTitle}
                onChange={e => setNewForumTitle(e.target.value)}
              />
              <textarea
                className="textarea textarea-bordered w-full bg-base-100"
                placeholder="Descripción (opcional)"
                value={newForumDescription}
                onChange={e => setNewForumDescription(e.target.value)}
              />
              <Button
                size="sm"
                variant="primary"
                disabled={creatingForum || !newForumEventId || !newForumTitle.trim()}
                onClick={handleCreateForum}
              >
                {creatingForum ? 'Creando...' : 'Crear foro'}
              </Button>
            </div>
          )}
          <div className="space-y-3 overflow-y-auto max-h-[480px] pr-1">
            {forums.length === 0 && !loadingForums && (
              <p className="text-sm text-gray-400">Aún no hay foros registrados.</p>
            )}
            {forums.map(forum => (
              <button
                key={forum.id}
                onClick={() => setSelectedForumId(forum.id)}
                className={`w-full text-left p-3 rounded-lg border transition ${
                  forum.id === selectedForumId ? 'border-primary bg-primary/10' : 'border-base-300 hover:border-primary/50'
                }`}
              >
                <div className="font-semibold text-lg">{forum.title}</div>
                <div className="text-xs text-gray-400">Evento #{forum.eventId ?? 'N/A'} · {forum.status ?? 'Activo'}</div>
                <div className="text-xs text-gray-500 mt-1">Creado: {formatDate(forum.createdAt)}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="lg:col-span-2 bg-base-200/60 rounded-xl p-5 border border-base-300 flex flex-col gap-4">
          {selectedForum ? (
            <>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-2xl font-bold">{selectedForum.title}</h2>
                  <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-sm">
                    Evento #{selectedForum.eventId ?? 'N/A'}
                  </span>
                  {subscribing && <span className="text-sm text-gray-400">Conectando al canal...</span>}
                </div>
                <p className="text-gray-300">{selectedForum.description || 'Sin descripción registrada.'}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-base-100/60 rounded-lg p-4 border border-base-300 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold">Historial reciente</h3>
                    {loadingPosts && <span className="text-xs text-gray-500">Actualizando...</span>}
                  </div>
                  <div className="space-y-3 overflow-y-auto max-h-72 pr-1">
                    {forumPosts.length === 0 && !loadingPosts && (
                      <p className="text-sm text-gray-500">No hay publicaciones para este foro.</p>
                    )}
                    {forumPosts.map(post => (
                      <article key={`${post.id}-${post.datePosted}`} className="p-3 rounded-lg bg-base-200/80">
                        <div className="text-xs text-gray-400 flex justify-between">
                          <span>{post.userId || 'anónimo'}</span>
                          <span>{formatDate(post.datePosted)}</span>
                        </div>
                        <p className="mt-2 text-sm whitespace-pre-wrap">{post.content}</p>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="bg-base-100/60 rounded-lg p-4 border border-base-300 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold">Feed en vivo</h3>
                    {liveFeed.length > 0 && (
                      <span className="text-xs text-primary">{liveFeed.length} eventos recientes</span>
                    )}
                  </div>
                  <div className="space-y-2 overflow-y-auto max-h-72 pr-1">
                    {liveFeed.length === 0 && (
                      <p className="text-sm text-gray-500">Escucha activa... aún no hay nuevos mensajes.</p>
                    )}
                    {liveFeed.map((entry, idx) => (
                      <article key={`${entry.postId ?? idx}-${entry.receivedAt}`} className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                        <div className="text-xs text-primary flex justify-between">
                          <span>{entry.author || 'anónimo'}</span>
                          <span>{formatDate(entry.receivedAt)}</span>
                        </div>
                        <p className="mt-2 text-sm whitespace-pre-wrap text-white">{entry.content || '(sin contenido)'}</p>
                      </article>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-base-100/60 rounded-lg p-4 border border-base-300">
                <h3 className="text-lg font-semibold mb-2">Publicar un mensaje</h3>
                <input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Título del anuncio"
                  className="w-full mb-3 p-3 rounded bg-base-200 border border-base-300 focus:outline-none focus:border-primary"
                />
                <textarea
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Comparte una actualización o responde a la audiencia..."
                  className="w-full h-32 p-3 rounded bg-base-200 border border-base-300 focus:outline-none focus:border-primary"
                />
                <div className="text-right mt-3">
                  <Button onClick={handlePublish} disabled={publishing || !newMessage.trim()}>
                    {publishing ? 'Enviando...' : 'Publicar en el foro'}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-16 text-gray-400">
              Selecciona un foro para comenzar a monitorear la conversación.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ForumMonitorPage;
