import type { Cr720_wfrd3dobjs_2s } from '../generated/models/Cr720_wfrd3dobjs_2sModel';
import { Cr720_wfrd3dobjs_2sService } from '../generated/services/Cr720_wfrd3dobjs_2sService';

const FILE_COLUMN = 'cr720_attachments' as const;
const SUPPORTED_EXTENSIONS = new Set(['glb', 'gltf', 'obj', 'stl', 'fbx']);
const MODEL_CACHE_DATABASE = 'weparts-3d-cache';
const MODEL_CACHE_STORE = 'models';

interface CachedModel {
  key: string;
  fileName: string;
  data: ArrayBuffer;
  storedAt: number;
}

const memoryModelCache = new Map<string, Promise<{ data: Uint8Array; fileName: string }>>();

function modelCacheKey(record: ThreeDObjectRecord) {
  return `${record.id}:${record.modifiedOn || 'unversioned'}:${record.fileName}`;
}

function openModelCache(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(MODEL_CACHE_DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(MODEL_CACHE_STORE)) request.result.createObjectStore(MODEL_CACHE_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function readCachedModel(key: string): Promise<CachedModel | null> {
  const database = await openModelCache();
  if (!database) return null;
  return new Promise((resolve) => {
    const request = database.transaction(MODEL_CACHE_STORE, 'readonly').objectStore(MODEL_CACHE_STORE).get(key);
    request.onsuccess = () => { database.close(); resolve((request.result as CachedModel | undefined) || null); };
    request.onerror = () => { database.close(); resolve(null); };
  });
}

async function writeCachedModel(model: CachedModel) {
  const database = await openModelCache();
  if (!database) return;
  await new Promise<void>((resolve) => {
    const transaction = database.transaction(MODEL_CACHE_STORE, 'readwrite');
    transaction.objectStore(MODEL_CACHE_STORE).put(model);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); resolve(); };
  });
}

function isSupported3DFile(fileName: string) {
  const extension = fileName.toLowerCase().split('.').pop() || '';
  return Boolean(fileName) && SUPPORTED_EXTENSIONS.has(extension);
}

export interface ThreeDObjectRecord {
  id: string;
  equipmentId: string;
  description: string;
  productLine: string;
  fileName: string;
  modifiedOn: string;
  hasAttachment: boolean;
}

function mapRecord(record: Cr720_wfrd3dobjs_2s): ThreeDObjectRecord {
  return {
    id: record.cr720_wfrd3dobjs_2id,
    equipmentId: record.cr720_id?.trim() || 'No equipment ID',
    description: record.cr720_equipment_description?.trim() || 'Untitled 3D object',
    productLine: record.cr720_pl?.trim() || 'Unassigned product line',
    fileName: record.cr720_attachments_name?.trim() || '',
    modifiedOn: record.modifiedon || '',
    hasAttachment: Boolean(record.cr720_attachments || record.cr720_attachments_name),
  };
}

export async function getThreeDObjects(productLine?: string): Promise<ThreeDObjectRecord[]> {
  const result = await Cr720_wfrd3dobjs_2sService.getAll({
    select: [
      'cr720_wfrd3dobjs_2id',
      'cr720_id',
      'cr720_equipment_description',
      'cr720_pl',
      'cr720_attachments',
      'cr720_attachments_name',
      'modifiedon',
    ],
    filter: productLine ? `statecode eq 0 and cr720_pl eq '${productLine.replaceAll("'", "''")}'` : 'statecode eq 0',
    orderBy: ['cr720_equipment_description asc'],
    top: 250,
  });

  if (!result.success) {
    throw new Error(result.error?.message || 'Dataverse did not return the 3D object list.');
  }

  return (result.data || [])
    .map(mapRecord)
    .filter((record) => record.hasAttachment && isSupported3DFile(record.fileName));
}

export async function downloadThreeDObject(record: ThreeDObjectRecord) {
  const key = modelCacheKey(record);
  const existing = memoryModelCache.get(key);
  if (existing) return existing;

  const load = (async () => {
    const cached = await readCachedModel(key);
    if (cached?.data) return { data: new Uint8Array(cached.data), fileName: cached.fileName };

    const result = await Cr720_wfrd3dobjs_2sService.downloadFile(record.id, FILE_COLUMN);
    if (!result.success || !result.data) throw new Error(result.error?.message || `Unable to download ${record.fileName || 'the model file'}.`);

    const fileName = result.fileName || record.fileName || 'model.glb';
    const data = result.data;
    const cachedData = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    void writeCachedModel({ key, fileName, data: cachedData, storedAt: Date.now() });
    return { data, fileName };
  })();

  memoryModelCache.set(key, load);
  load.catch(() => memoryModelCache.delete(key));
  return load;
}
