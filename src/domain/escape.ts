const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa texto para interpolação segura em HTML (conteúdo e atributos entre aspas). */
export const escapeHtml = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (ch) => ENTITIES[ch]);
