'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { resumeEventSchema, type ResumeEvent, type ResumeRequest } from '../lib/schema';

type Usage = Extract<ResumeEvent, { type: 'done' }>['usage'];

export type ResumeDraftState =
  | { status: 'idle' }
  | { status: 'streaming'; text: string }
  | { status: 'done'; text: string; truncated: boolean; usage: Usage }
  | { status: 'stopped'; text: string }
  /** loginRequired: 로그인하지 않아 서버가 거절했다 */
  | { status: 'error'; text: string; message: string; loginRequired: boolean };

const errorBodySchema = z.object({ message: z.string() });

function parseJson(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

/** /api/resume의 NDJSON 스트림을 읽어 초안 텍스트를 쌓는다. */
export function useResumeDraft() {
  const [state, setState] = useState<ResumeDraftState>({ status: 'idle' });
  const controllerRef = useRef<AbortController | null>(null);

  // 화면을 떠나면 진행 중인 요청을 끊는다.
  useEffect(() => () => controllerRef.current?.abort(), []);

  const stop = useCallback(() => controllerRef.current?.abort(), []);

  const generate = useCallback(async (request: ResumeRequest) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    let text = '';
    setState({ status: 'streaming', text });

    const fail = (message: string, loginRequired = false) =>
      setState({ status: 'error', text, message, loginRequired });

    try {
      const response = await fetch('/api/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const body = errorBodySchema.safeParse(await response.json().catch(() => null));
        fail(body.success ? body.data.message : '초안을 만들지 못했어요. 다시 시도해 주세요.', response.status === 401);
        return;
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = resumeEventSchema.safeParse(parseJson(line));
          if (!event.success) continue;

          switch (event.data.type) {
            case 'text':
              text += event.data.text;
              setState({ status: 'streaming', text });
              break;
            case 'done':
              setState({
                status: 'done',
                text,
                truncated: event.data.stopReason === 'max_tokens',
                usage: event.data.usage,
              });
              return;
            case 'error':
              fail(event.data.message);
              return;
          }
        }
      }
      // done 이벤트 없이 스트림이 끝났다 (연결 끊김 등)
      fail('응답이 중간에 끊겼어요. 다시 시도해 주세요.');
    } catch (error) {
      if (controller.signal.aborted) {
        setState({ status: 'stopped', text });
      } else {
        console.error('[useResumeDraft]', error);
        fail('서버에 연결하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.');
      }
    }
  }, []);

  return { state, generate, stop };
}
