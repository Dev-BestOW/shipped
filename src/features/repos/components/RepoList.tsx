import { Badge, Link, Stack, Typography } from '@bestow-ui/react';
import NextLink from 'next/link';
import { DividedList, DividedListItem } from '@/components/ui/DividedList';
import type { Repository } from '@/server/github/api';

const dateFormatter = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' });

export function RepoList({ repos }: { repos: Repository[] }) {
  return (
    <DividedList>
      {repos.map(repo => (
        <DividedListItem key={repo.id}>
          <Stack gap={1}>
            <Stack direction="row" align="center" gap={2} wrap>
              <Link asChild color="neutral" underline="hover">
                <NextLink href={`/repos/${repo.fullName}`}>
                  <Typography as="span" weight="semibold">
                    {repo.fullName}
                  </Typography>
                </NextLink>
              </Link>
              {repo.isPrivate && (
                <Badge variant="outline" color="neutral" size="sm">
                  비공개
                </Badge>
              )}
              <Typography variant="caption" color="muted" as="span" style={{ marginInlineStart: 'auto' }}>
                <Link href={repo.url} color="inherit" underline="hover" external>
                  GitHub에서 보기
                </Link>
              </Typography>
            </Stack>
            {repo.description && (
              <Typography variant="body-sm" color="muted">
                {repo.description}
              </Typography>
            )}
            <Typography variant="caption" color="subtle">
              {[repo.language, repo.pushedAt && `최근 푸시 ${dateFormatter.format(new Date(repo.pushedAt))}`]
                .filter(Boolean)
                .join(' · ')}
            </Typography>
          </Stack>
        </DividedListItem>
      ))}
    </DividedList>
  );
}
