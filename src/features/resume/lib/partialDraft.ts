import { partialParse } from '@anthropic-ai/sdk/_vendor/partial-json-parser/parser';
import { z } from 'zod';
import type { DraftSentence } from './draft';

/** 스트리밍 중 덜 완성된 초안. 아직 안 온 필드는 비어 있다. */
export type PartialDraft = {
  summary: { overview?: string; period?: string; role?: string; techStack: string[] };
  achievements: { title?: string; sentences: Partial<DraftSentence>[] }[];
};

// 덜 완성된 JSON은 어느 필드든 비어 있거나 잘려 있을 수 있어, 모든 필드를 선택으로 두고 맞지 않으면 버린다.
const partialSentenceSchema = z
  .object({
    kind: z.enum(['problem', 'solution', 'result']).optional().catch(undefined),
    text: z.string().optional().catch(undefined),
    evidence: z.array(z.string()).optional().catch(undefined),
  })
  .catch({});

const partialDraftSchema = z.object({
  summary: z
    .object({
      overview: z.string().optional().catch(undefined),
      period: z.string().optional().catch(undefined),
      role: z.string().optional().catch(undefined),
      techStack: z.array(z.string()).catch([]).default([]),
    })
    .catch({ techStack: [] })
    .default({ techStack: [] }),
  achievements: z
    .array(
      z
        .object({
          title: z.string().optional().catch(undefined),
          sentences: z.array(partialSentenceSchema).catch([]).default([]),
        })
        .catch({ sentences: [] }),
    )
    .catch([])
    .default([]),
});

/** 스트리밍으로 받은 초안 JSON 조각을 읽는다. 아직 아무것도 읽을 수 없으면 null. */
export function parsePartialDraft(text: string): PartialDraft | null {
  if (!text.trim().startsWith('{')) return null;
  try {
    return partialDraftSchema.parse(partialParse(text));
  } catch {
    return null;
  }
}
