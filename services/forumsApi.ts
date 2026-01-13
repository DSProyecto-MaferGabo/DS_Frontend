import keycloak from './keycloakService';

const BASE_URL = import.meta.env.VITE_FORUMS_API_URL || 'http://localhost:5256/api';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

type Json = Record<string, unknown> | Array<unknown> | null;

async function request<T = Json>(path: string, method: HttpMethod = 'GET', body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = keycloak.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      detail = '';
    }

    const error: any = new Error(detail || `HTTP ${res.status}`);
    error.status = res.status;
    error.detail = detail;
    throw error;
  }

  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    console.warn('[forumsApi] Failed to parse response for', `${method} ${path}`, text);
    throw err;
  }
}

export interface ForumTopic {
  id: number;
  title: string;
  description?: string;
  eventId?: number | null;
  createdAt?: string;
  status?: string;
  ownerId?: string;
}

export interface ForumComment {
  id: number;
  publicationId: number;
  userId?: string;
  content: string;
  createdAt?: string;
  status?: string;
}

export interface ForumPost {
  id: number;
  forumId: number;
  userId?: string;
  title?: string;
  content: string;
  datePosted?: string;
  status?: string;
  comments?: ForumComment[];
}

export interface CreateForumPostPayload {
  forumId: number;
  eventId: number;
  title: string;
  content: string;
  userId: string;
  datePosted?: string;
  status?: string;
}

export interface CreateForumCommentPayload {
  publicationId: number;
  eventId: number;
  content: string;
}

export interface CreateForumPayload {
  eventId: number;
  title: string;
  description?: string;
  status?: string;
}

function mapForum(dto: any): ForumTopic {
  return {
    id: Number(dto.id ?? dto.Id ?? dto.forumId ?? 0),
    title: dto.title ?? dto.Title ?? 'Sin título',
    description: dto.description ?? dto.Description ?? '',
    eventId: dto.idEvent ?? dto.IdEvent ?? dto.eventId ?? dto.EventId ?? null,
    createdAt: dto.dateCreation ?? dto.DateCreation ?? dto.createdAt ?? dto.CreatedAt,
    status: dto.status ?? dto.Status ?? 'Activo',
    ownerId: dto.idUserCreator ?? dto.IdUserCreator ?? dto.ownerId ?? null,
  };
}

function mapComment(dto: any): ForumComment {
  return {
    id: Number(dto.id ?? dto.Id ?? 0),
    publicationId: Number(dto.publicationId ?? dto.PublicationId ?? 0),
    userId: dto.userId ?? dto.UserId ?? null,
    content: dto.content ?? dto.Content ?? '',
    createdAt: dto.createdAtUtc ?? dto.CreatedAtUtc ?? dto.createdAt ?? dto.CreatedAt,
    status: dto.status ?? dto.Status ?? 'Publicado',
  };
}

function mapPost(dto: any): ForumPost {
  const rawComments = Array.isArray(dto.comments ?? dto.Comments) ? dto.comments ?? dto.Comments : [];
  return {
    id: Number(dto.id ?? dto.Id ?? dto.publicationId ?? 0),
    forumId: Number(dto.forumId ?? dto.ForumId ?? dto.idForum ?? dto.IdForum ?? 0),
    userId: dto.userId ?? dto.UserId ?? dto.authorId ?? null,
    title: dto.title ?? dto.Title ?? '',
    content: dto.content ?? dto.Content ?? '',
    datePosted: dto.datePosted ?? dto.DatePosted ?? dto.createdAt ?? dto.CreatedAt,
    status: dto.status ?? dto.Status ?? 'Publicado',
    comments: rawComments.map(mapComment),
  };
}

const forumsApi = {
  getForums: async () => {
    const forums = await request<any[]>('/Forum');
    return (forums || []).map(mapForum);
  },
  getForumsByEvent: async (eventId: number) => {
    const forums = await request<any[]>(`/Forum?eventId=${eventId}`);
    return (forums || []).map(mapForum);
  },
  getForum: async (id: number) => {
    const forum = await request<any>(`/Forum/${id}`);
    return mapForum(forum);
  },
  getForumPosts: async (forumId: number) => {
    const posts = await request<any[]>(`/Publication?forumId=${forumId}`);
    return (posts || []).map(mapPost);
  },
  getPost: async (id: number, includeComments = true) => {
    const post = await request<any>(`/Publication/${id}?includeComments=${includeComments}`);
    return mapPost(post);
  },
  createForum: async (payload: CreateForumPayload) => {
    const body = {
      Title: payload.title,
      Description: payload.description ?? '',
      EventId: payload.eventId,
      Status: payload.status ?? 'Activo'
    };
    return request('/Forum', 'POST', body);
  },
  createPost: async (payload: CreateForumPostPayload) => {
    const body = {
      ForumId: payload.forumId,
      EventId: payload.eventId,
      Title: payload.title,
      Content: payload.content,
      Status: payload.status ?? 'Publicado',
    };
    return request('/Publication', 'POST', body);
  },
  createComment: async (payload: CreateForumCommentPayload) => {
    const body = {
      EventId: payload.eventId,
      Content: payload.content,
    };
    return request(`/Publication/${payload.publicationId}/comments`, 'POST', body);
  },
};

export default forumsApi;
