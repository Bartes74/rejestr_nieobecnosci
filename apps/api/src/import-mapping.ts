import { BadRequestException } from '@nestjs/common';

// L1 — bezpieczne parsowanie pola "mapping" (multipart). Brak → undefined; błędny JSON → 400 (nie 500).
export function parseMapping(raw?: string): Record<string, string> | undefined {
  if (!raw) return undefined;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('mapping musi być obiektem');
    return v as Record<string, string>;
  } catch {
    throw new BadRequestException('Pole "mapping" musi być poprawnym obiektem JSON.');
  }
}
