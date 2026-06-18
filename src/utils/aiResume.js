import { getConfiguredModel, getOpenAiOverrideHeaders } from './aiIntake';
import { authHeaders } from './api';

export async function tailorResumeWithAi({
  baseResume,
  jobDescription,
  jobContext,
  model = getConfiguredModel()
}) {
  const res = await fetch('/api/ai/resume-version', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getOpenAiOverrideHeaders(),
      ...authHeaders()
    },
    body: JSON.stringify({
      model,
      baseResume,
      jobDescription,
      jobContext
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `AI resume editor failed (${res.status}).`);

  return normalizeResumeVersion(data);
}

export function normalizeResumeVersion(raw = {}) {
  return {
    title: String(raw.title || 'Tailored resume').trim(),
    summary: String(raw.summary || '').trim(),
    tailoredResume: String(raw.tailoredResume || '').trim(),
    keywordMatches: Array.isArray(raw.keywordMatches)
      ? raw.keywordMatches.map((item) => String(item || '').trim()).filter(Boolean)
      : [],
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.map((item) => String(item || '').trim()).filter(Boolean)
      : []
  };
}
