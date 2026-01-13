import keycloak from './keycloakService';

const BASE_URL = import.meta.env.VITE_MEDIAFILE_API_URL || 'http://localhost:5125/api';

const MEDIA_ENDPOINT = `${BASE_URL}/File`;

export type MediaFileType = 'poster' | 'program' | 'payment-receipt';

async function ensureToken() {
  try {
    await keycloak.ensureTokenValid(30);
  } catch {
    // ignore token refresh errors; request may still work for public endpoints
  }
}

function buildAuthHeaders(): HeadersInit | undefined {
  const token = keycloak.getToken();
  if (!token) return undefined;
  return { Authorization: `Bearer ${token}` };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: string | null = null;
    try {
      body = await res.text();
    } catch {
      body = null;
    }
    const error = new Error(`HTTP ${res.status}`);
    (error as any).status = res.status;
    (error as any).body = body;
    throw error;
  }
  // uploads may return empty body -> try text then parse JSON
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

export interface UploadPosterResponse {
  id?: number;
  Id?: number;
  idEvent?: number;
  IdEvent?: number;
  originalFileName?: string;
  OriginalFileName?: string;
  publicUrl?: string;
  url?: string;
  expiresInMinutes?: number;
  fileType?: string;
  FileType?: string;
}

export interface FileMetadataResponse {
  id: number;
  idEvent?: number;
  storageObjectKey?: string | null;
  StorageObjectKey?: string | null;
  storageBucket?: string | null;
  StorageBucket?: string | null;
  publicUrl?: string | null;
}

interface UploadEventFileParams {
  eventId: number;
  file: File;
  fileType: MediaFileType;
  resolution?: string;
  duration?: string;
}

export interface MediaFileRecord {
  id?: number;
  Id?: number;
  idEvent?: number;
  IdEvent?: number;
  originalFileName?: string;
  OriginalFileName?: string;
  mimeType?: string;
  MimeType?: string;
  dateCreated?: string;
  DateCreated?: string;
  size?: string;
  Size?: string;
  fileType?: string;
  FileType?: string;
  publicUrl?: string;
  url?: string;
}

async function uploadEventFile(params: UploadEventFileParams) {
  await ensureToken();
  const formData = new FormData();
  formData.append('EventId', String(params.eventId));
  formData.append('File', params.file);
  formData.append('FileType', params.fileType);
  if (params.resolution) {
    formData.append('Resolution', params.resolution);
  }
  if (params.duration) {
    formData.append('Duration', params.duration);
  }

  const headers = buildAuthHeaders();
  const res = await fetch(`${MEDIA_ENDPOINT}/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });
  return handleResponse<UploadPosterResponse>(res);
}

export async function uploadEventPoster(params: { eventId: number; file: File; resolution?: string; duration?: string; fileType?: MediaFileType }) {
  return uploadEventFile({
    eventId: params.eventId,
    file: params.file,
    fileType: params.fileType ?? 'poster',
    resolution: params.resolution,
    duration: params.duration,
  });
}

export async function getFileMetadata(id: number) {
  await ensureToken();
  const headers = buildAuthHeaders();
  const res = await fetch(`${MEDIA_ENDPOINT}/${id}`, {
    method: 'GET',
    headers,
  });
  return handleResponse<FileMetadataResponse>(res);
}

export async function getEventFiles(eventId: number, fileType?: MediaFileType) {
  await ensureToken();
  const headers = buildAuthHeaders();
  const url = new URL(`${MEDIA_ENDPOINT}/event/${eventId}`);
  if (fileType) {
    url.searchParams.set('fileType', fileType);
  }
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers,
  });
  return handleResponse<MediaFileRecord[]>(res);
}

export async function getSingleEventFile(eventId: number, fileType: MediaFileType) {
  const files = await getEventFiles(eventId, fileType);
  return files && files.length > 0 ? files[0] : null;
}

export default {
  uploadEventFile,
  uploadEventPoster,
  getFileMetadata,
  getEventFiles,
  getSingleEventFile,
};
