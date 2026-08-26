import { supabase } from '../supabaseClient';

const EVIDENCE_BUCKET = 'athlete_evidence';
const DEFAULT_SIGNED_URL_TTL_SECONDS = 15 * 60;
const PUBLIC_EVIDENCE_MARKER = '/storage/v1/object/public/athlete_evidence/';

export const getEvidencePath = (value) => {
  if (!value || typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const markerIndex = trimmed.indexOf(PUBLIC_EVIDENCE_MARKER);
  if (markerIndex >= 0) {
    const encodedPath = trimmed.slice(
      markerIndex + PUBLIC_EVIDENCE_MARKER.length,
    );

    try {
      return decodeURIComponent(encodedPath);
    } catch {
      return encodedPath;
    }
  }

  // Canonical database values are bucket-relative paths, never absolute URLs.
  if (!trimmed.includes('://')) {
    return trimmed.replace(/^\/+/, '');
  }

  return null;
};

export const createEvidenceSignedUrl = async (
  pathOrLegacyPublicUrl,
  expiresIn = DEFAULT_SIGNED_URL_TTL_SECONDS,
) => {
  const path = getEvidencePath(pathOrLegacyPublicUrl);

  if (!path) {
    return {
      path: null,
      signedUrl: null,
    };
  }

  const { data, error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) throw error;

  return {
    path,
    signedUrl: data?.signedUrl || null,
  };
};

export const createEvidenceSignedUrls = async (
  pathOrUrlValues,
  expiresIn = DEFAULT_SIGNED_URL_TTL_SECONDS,
) => {
  const entries = await Promise.all(
    (pathOrUrlValues || []).map(async (value) => {
      const result = await createEvidenceSignedUrl(value, expiresIn);
      return [value, result];
    }),
  );

  return new Map(entries);
};

export const EVIDENCE_SIGNED_URL_TTL_SECONDS =
  DEFAULT_SIGNED_URL_TTL_SECONDS;
