import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import forumsApi, {
  ForumTopic,
  ForumPost,
  ForumComment,
} from '../../services/forumsApi';
import eventsApi from '../../services/eventsApi';
import reservationsApi from '../../services/reservationsApi';
import { Button } from '../../components/ui/Button';
import { useKeycloak } from '../../hooks/useKeycloak';
import {
  joinForumChannel,
  leaveForumChannel,
  registerForumPostHandler,
  type ForumPostPayload,
} from '../../services/notificationHubClient';

interface CommentDrafts {
  [postId: number]: string;
}

export const EventForumPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useKeycloak();
  const [forums, setForums] = useState<ForumTopic[]>([]);
  const [selectedForumId, setSelectedForumId] = useState<number | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loadingForums, setLoadingForums] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [commentDrafts, setCommentDrafts] = useState<CommentDrafts>({});
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const eventId = useMemo(() => Number(id), [id]);

  const loadForums = useCallback(async () => {
    if (!accessChecked || !hasAccess) return;
    if (!eventId || Number.isNaN(eventId)) {
      setError('Evento inválido para foros.');
      return;
    }
    setLoadingForums(true);
    setError(null);
    try {
      const data = await forumsApi.getForumsByEvent(eventId);
      setForums(data);
      if (data.length > 0 && !selectedForumId) {
        setSelectedForumId(data[0].id);
      } else if (data.length === 0) {
        setPosts([]);
      }
    } catch (err) {
      console.error('No se pudieron cargar los foros del evento', err);
      setError('No se pudieron cargar los foros asociados.');
    } finally {
      setLoadingForums(false);
    }
  }, [eventId, selectedForumId, accessChecked, hasAccess]);

  const loadPosts = useCallback(async (forumId: number) => {
    setLoadingPosts(true);
    try {
      const result = await forumsApi.getForumPosts(forumId);
      setPosts(result);
    } catch (err) {
      console.error('No se pudieron cargar las publicaciones', err);
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  useEffect(() => {
    loadForums();
  }, [loadForums]);

  useEffect(() => {
    if (!eventId || Number.isNaN(eventId) || !profile) return;
    const roles = profile.roles || [];
    const checkAccess = async () => {
      try {
        setAccessChecked(false);
        setHasAccess(false);
        setAccessMessage(null);
        const evt = await eventsApi.getEvent(eventId);
        const isAdmin = roles.includes('administrador');
        const isOwnerOrganizer = roles.includes('organizador') && evt?.ownerId && profile.id && String(evt.ownerId) === String(profile.id);
        if (isAdmin || isOwnerOrganizer) {
          setHasAccess(true);
          return;
        }
        const reservations = await reservationsApi.getReservations(profile.id);
        const paidStates = ['confirmada','confirmado','paid','pagada','pagado','completada','completado','completed','confirmed'];
        const hasTicket = (reservations || []).some((r: any) => {
          const evId = Number(r.eventoId ?? r.EventId ?? r.eventId ?? r.EventoId ?? 0);
          const estado = String(r.estado ?? r.State ?? r.state ?? '').toLowerCase();
          return evId === Number(eventId) && paidStates.includes(estado);
        });
        setHasAccess(hasTicket);
        if (!hasTicket) {
          setAccessMessage('Solo usuarios con entrada confirmada u organizador del evento pueden acceder al foro.');
        }
      } catch (err) {
        console.error('No se pudo verificar acceso al foro', err);
        setAccessMessage('No se pudo verificar el acceso al foro. Intenta nuevamente.');
      } finally {
        setAccessChecked(true);
      }
    };
    checkAccess();
  }, [eventId, profile]);

  useEffect(() => {
    if (!selectedForumId || !hasAccess) {
      setPosts([]);
      return;
    }
    loadPosts(selectedForumId);
  }, [selectedForumId, loadPosts, hasAccess]);

  useEffect(() => {
    if (!selectedForumId || !hasAccess) return;
    let disposed = false;

    const subscribe = async () => {
      try {
        await joinForumChannel(selectedForumId);
        const unsubscribe = await registerForumPostHandler(async (payload: ForumPostPayload) => {
          if (disposed || !payload) return;
          const topic = (payload.topicId ?? (payload as any).TopicId ?? '').toString();
          if (!topic || topic !== selectedForumId.toString()) return;
          const kind = payload.metadata?.kind ?? payload.metadata?.Kind ?? '';

          if (kind === 'post' && payload.postId) {
            const fresh = await forumsApi.getPost(Number(payload.postId)).catch(() => null);
            if (fresh) {
              setPosts(prev => {
                const filtered = prev.filter(p => p.id !== fresh.id);
                return [fresh, ...filtered];
              });
            }
            return;
          }

          if (kind === 'comment' && payload.postId) {
            const comment: ForumComment = {
              id: Number(payload.metadata?.commentId ?? Date.now()),
              publicationId: Number(payload.postId),
              userId: payload.metadata?.authorId ?? payload.author ?? undefined,
              content: payload.content ?? '',
              createdAt: new Date().toISOString(),
              status: 'Publicado',
            };
            setPosts(prev => prev.map(post => {
              if (post.id !== comment.publicationId) return post;
              const comments = [comment, ...(post.comments ?? [])];
              return { ...post, comments };
            }));
          }
        });
        unsubscribeRef.current = unsubscribe;
      } catch (err) {
        console.warn('No se pudo suscribir al foro del evento', err);
      }
    };

    subscribe();
    return () => {
      disposed = true;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      leaveForumChannel(selectedForumId).catch(() => {});
    };
  }, [selectedForumId]);

  const selectedForum = useMemo(() => forums.find(f => f.id === selectedForumId) ?? null, [forums, selectedForumId]);

  const handleCreatePost = async () => {
    if (!selectedForum || !eventId || !hasAccess) {
      alert('Selecciona un foro válido.');
      return;
    }
    if (!newPostTitle.trim() || !newPostContent.trim()) {
      alert('Completa el título y el contenido.');
      return;
    }

    try {
      await forumsApi.createPost({
        forumId: selectedForum.id,
        eventId: selectedForum.eventId ?? eventId,
        title: newPostTitle.trim(),
        content: newPostContent.trim(),
        userId: profile?.id ?? 'frontend-user',
      });
      setNewPostTitle('');
      setNewPostContent('');
    } catch (err) {
      console.error('No se pudo crear la publicación', err);
      alert('No se pudo crear la publicación.');
    }
  };

  const handleSendComment = async (postId: number) => {
    const text = commentDrafts[postId]?.trim();
    if (!text) return;
    if (!selectedForum || !hasAccess) return;

    try {
      await forumsApi.createComment({
        publicationId: postId,
        eventId: selectedForum.eventId ?? eventId,
        content: text,
      });
      setCommentDrafts(prev => ({ ...prev, [postId]: '' }));
    } catch (err) {
      console.error('No se pudo enviar el comentario', err);
      alert('No se pudo enviar tu comentario.');
    }
  };

  if (!eventId || Number.isNaN(eventId)) {
    return <div className="text-center p-10">Evento inválido.</div>;
  }

  if (accessChecked && !hasAccess) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-3xl font-bold">Acceso restringido</h1>
        <p className="text-gray-300">{accessMessage || 'Solo usuarios con entrada confirmada u organizador del evento pueden acceder al foro.'}</p>
        <div className="flex justify-center gap-3">
          <Button onClick={() => navigate(`/evento/${eventId}`)} variant="secondary">Volver al evento</Button>
          <Button onClick={() => navigate('/')}>Ir al inicio</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-2 text-center">
        <p className="uppercase tracking-widest text-sm text-primary">Comunidad en vivo</p>
        <h1 className="text-4xl font-extrabold">Foro del Evento</h1>
        <p className="text-gray-300">
          Chatea con asistentes y organizadores en tiempo real. Los mensajes aparecen al instante gracias a SignalR.
        </p>
      </header>

      {error && <div className="bg-red-500/20 border border-red-500 text-red-200 p-3 rounded-lg text-center">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="bg-base-200/60 rounded-2xl p-5 border border-base-300 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">Foros del evento</h2>
            {loadingForums && <span className="text-xs text-gray-400">Cargando...</span>}
          </div>
          <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1">
            {forums.length === 0 && !loadingForums && (
              <p className="text-sm text-gray-400">Aún no hay foros configurados para este evento.</p>
            )}
            {forums.map(forum => (
              <button
                key={forum.id}
                onClick={() => setSelectedForumId(forum.id)}
                className={`w-full text-left p-4 rounded-xl border transition ${
                  forum.id === selectedForumId ? 'border-primary bg-primary/10' : 'border-base-300 hover:border-primary/40'
                }`}
              >
                <div className="font-semibold text-lg">{forum.title}</div>
                <p className="text-xs text-gray-400 line-clamp-2 mt-1">{forum.description || 'Sin descripción.'}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="lg:col-span-2 bg-base-200/60 rounded-2xl p-5 border border-base-300 flex flex-col gap-4">
          {selectedForum ? (
            <>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-3xl font-bold">{selectedForum.title}</h2>
                  <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-sm">
                    Evento #{selectedForum.eventId ?? eventId}
                  </span>
                  {loadingPosts && <span className="text-xs text-gray-400">Actualizando…</span>}
                </div>
                <p className="text-gray-300">{selectedForum.description || 'Participa en la conversación con todos los asistentes.'}</p>
              </div>

              <div className="bg-base-100/60 rounded-xl border border-base-300 p-4 space-y-3">
                <h3 className="text-lg font-semibold">Crear publicación</h3>
                <input
                  value={newPostTitle}
                  onChange={e => setNewPostTitle(e.target.value)}
                  placeholder="Título de tu mensaje"
                  className="w-full p-3 rounded bg-base-200 border border-base-300 focus:outline-none focus:border-primary"
                />
                <textarea
                  value={newPostContent}
                  onChange={e => setNewPostContent(e.target.value)}
                  placeholder="Comparte ideas, anuncios o inicia la conversación…"
                  className="w-full h-28 p-3 rounded bg-base-200 border border-base-300 focus:outline-none focus:border-primary"
                />
                <div className="text-right">
                  <Button onClick={handleCreatePost} disabled={!newPostTitle.trim() || !newPostContent.trim()}>
                    Publicar
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {posts.length === 0 && !loadingPosts && (
                  <div className="text-center py-10 text-gray-400 bg-base-100/40 rounded-xl border border-dashed border-base-300">
                    Aún no hay publicaciones. Sé la primera persona en escribir.
                  </div>
                )}

                {posts.map(post => (
                  <article key={post.id} className="bg-base-100/70 rounded-2xl border border-base-300 p-4 space-y-3">
                    <header className="flex flex-col gap-1">
                      <h4 className="text-xl font-semibold">{post.title || 'Publicación'}</h4>
                      <div className="text-xs text-gray-400 flex items-center gap-3">
                        <span>Autor #{post.userId ?? 'N/A'}</span>
                        {post.datePosted && <span>{new Date(post.datePosted).toLocaleString()}</span>}
                      </div>
                    </header>
                    <p className="text-sm whitespace-pre-wrap text-gray-100">{post.content}</p>

                    <section className="bg-base-200/60 rounded-xl p-3 space-y-3">
                      <h5 className="text-sm font-semibold text-gray-300">Comentarios ({post.comments?.length ?? 0})</h5>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {(post.comments ?? []).map(comment => (
                          <div key={comment.id} className="bg-base-100/80 rounded-lg p-2 text-sm border border-base-300">
                            <div className="text-xs text-gray-400 flex justify-between">
                              <span>Usuario #{comment.userId ?? 'N/A'}</span>
                              {comment.createdAt && <span>{new Date(comment.createdAt).toLocaleString()}</span>}
                            </div>
                            <p className="mt-1 whitespace-pre-wrap">{comment.content}</p>
                          </div>
                        ))}
                        {(post.comments ?? []).length === 0 && (
                          <p className="text-xs text-gray-500">Sé la primera persona en comentar.</p>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <textarea
                          value={commentDrafts[post.id] ?? ''}
                          onChange={e => setCommentDrafts(prev => ({ ...prev, [post.id]: e.target.value }))}
                          placeholder="Escribe un comentario"
                          className="w-full rounded-lg bg-base-100/80 border border-base-300 p-2 text-sm"
                          rows={3}
                        />
                        <div className="text-right">
                          <Button
                            size="sm"
                            onClick={() => handleSendComment(post.id)}
                            disabled={!commentDrafts[post.id]?.trim()}
                          >
                            Responder
                          </Button>
                        </div>
                      </div>
                    </section>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center text-gray-400 py-16">
              Selecciona un foro para comenzar a conversar.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default EventForumPage;
