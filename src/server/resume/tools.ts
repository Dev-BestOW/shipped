import 'server-only';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { ResumeEvent, ResumeRequest } from '@/features/resume/lib/schema';
import { findCommits, summarizeWorkAreas } from './analysis';

/** 커밋 하나에서 도구 결과로 돌려줄 최대 파일 수 */
const FILES_PER_COMMIT_IN_RESULT = 40;

type StepEvent = Extract<ResumeEvent, { type: 'step' }>;

/**
 * 경력기술서 분석 도구. 요청에 담긴 커밋 데이터만 읽고, 바깥(GitHub 등)으로 요청하지 않는다.
 * 도구를 실행할 때마다 onStep으로 화면에 보여 줄 단계를 알린다(id는 tool_use id).
 */
export function createResumeTools(input: ResumeRequest, onStep: (step: StepEvent) => void) {
  const getWorkAreas = betaZodTool({
    name: 'get_work_areas',
    description:
      '사용자가 커밋으로 바꾼 파일을 폴더별로 모아, 폴더마다 커밋 수와 변경 줄 수를 돌려줍니다(변경 줄이 많은 순). ' +
      '어떤 영역을 주로 작업했는지 파악할 때 먼저 부르세요. lockfile은 빠져 있습니다.',
    inputSchema: z.object({
      depth: z.number().int().min(1).max(4).describe('폴더를 몇 단계까지 나눌지. 보통 2 (예: src/features)'),
    }),
    eager_input_streaming: true,
    run: ({ depth }, context) => {
      const areas = summarizeWorkAreas(input.commits, depth, 20);
      onStep({
        type: 'step',
        id: context?.toolUse.id ?? `areas-${depth}`,
        label: '작업 영역 살펴보기',
        status: 'done',
        detail: areas.length > 0 ? `폴더 ${areas.length}곳 · 가장 많이 바꾼 곳 ${areas[0].area}` : '파일 정보 없음',
      });
      if (areas.length === 0) return '파일 정보가 없습니다. 커밋 메시지만으로 판단하세요.';
      return JSON.stringify(areas);
    },
  });

  const getCommitFiles = betaZodTool({
    name: 'get_commit_files',
    description:
      '고른 커밋들의 변경 파일 경로와 파일별 줄 수를 돌려줍니다. 코드 내용은 없습니다. ' +
      '성과 후보로 묶을 커밋이 실제로 어떤 파일을 바꿨는지 확인하고, 근거 커밋을 고를 때 쓰세요. 한 번에 최대 20개.',
    inputSchema: z.object({
      shas: z.array(z.string().regex(/^[0-9a-fA-F]{7,64}$/)).min(1).max(20).describe('커밋 짧은 해시(7자 이상) 목록'),
    }),
    eager_input_streaming: true,
    run: ({ shas }, context) => {
      const { found, notFound } = findCommits(input.commits, shas);
      const fileCount = found.reduce((sum, commit) => sum + (commit.lineStats?.files.length ?? 0), 0);
      const [firstSha] = shas;
      onStep({
        type: 'step',
        id: context?.toolUse.id ?? `files-${shas.join('-')}`,
        label:
          shas.length > 1
            ? `커밋 ${firstSha.slice(0, 7)} 외 ${shas.length - 1}개의 변경 파일 확인`
            : `커밋 ${firstSha.slice(0, 7)}의 변경 파일 확인`,
        status: 'done',
        detail: `파일 ${fileCount}개`,
      });
      return JSON.stringify({
        commits: found.map(commit => ({
          sha: commit.sha.slice(0, 7),
          headline: commit.message.split('\n', 1)[0],
          changedFiles: commit.lineStats?.changedFiles ?? null,
          files: commit.lineStats?.files.slice(0, FILES_PER_COMMIT_IN_RESULT) ?? null,
        })),
        notFound,
      });
    },
  });

  return [getWorkAreas, getCommitFiles];
}

/** tool_use 블록이 시작될 때 보여 줄 진행 중 단계 이름 */
export function runningLabelForTool(name: string): string {
  switch (name) {
    case 'get_work_areas':
      return '작업 영역 살펴보기';
    case 'get_commit_files':
      return '변경 파일 확인';
    default:
      return '자료 확인';
  }
}
