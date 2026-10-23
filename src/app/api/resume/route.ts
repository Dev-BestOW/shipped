import { NextResponse, type NextRequest } from 'next/server';
import { resumeRequestSchema, type ResumeEvent } from '@/features/resume/lib/schema';
import { describeResumeError, streamResumeDraft } from '@/server/resume/generate';
import { isResumeMockMode, streamMockResumeDraft } from '@/server/resume/mock';
import { getSession } from '@/server/session';

/** Claude가 도구를 부르며 분석하면 1분을 넘길 수 있다. 실제 상한은 배포 플랜에 따라 정해진다. */
export const maxDuration = 300;

function errorResponse(status: number, message: string) {
  return NextResponse.json({ message }, { status });
}

/**
 * 경력기술서 초안 생성. 응답은 NDJSON 스트림(한 줄에 ResumeEvent 하나)이다.
 * Claude 호출에 비용이 들어서 로그인한 사용자만 쓸 수 있다.
 */
export async function POST(request: NextRequest) {
  if (!(await getSession())) {
    return errorResponse(401, '경력기술서 생성은 GitHub로 로그인한 뒤 쓸 수 있어요.');
  }
  const mock = isResumeMockMode();
  if (!mock && !process.env.ANTHROPIC_API_KEY) {
    return errorResponse(503, '서버에 Claude API 키가 설정되지 않았어요.');
  }

  const parsed = resumeRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, '요청 형식이 올바르지 않아요.');
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ResumeEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      const draft = mock ? streamMockResumeDraft : streamResumeDraft;
      try {
        send({ type: 'start', mock });
        for await (const event of draft(parsed.data, request.signal)) {
          send(event);
        }
      } catch (error) {
        // 사용자가 멈춘 경우에는 받을 사람이 없다.
        if (!request.signal.aborted) {
          console.error('[api/resume]', error);
          send({ type: 'error', message: describeResumeError(error) });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // 사용자가 멈춰 스트림이 이미 취소됐다.
        }
      }
    },
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
