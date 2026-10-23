import { SENTENCE_KIND_LABEL, type ResumeDraft } from '../lib/draft';
import { keptAchievements, type DraftReview } from '../lib/review';
import styles from './PrintableResume.module.css';

/**
 * 인쇄(PDF 저장)할 때만 보이는 경력기술서. 수락·수정한 문장만 담고 근거 해시는 뺀다.
 * data-print-root가 있으면 globals.css의 인쇄 규칙이 이 영역만 남기고 나머지를 숨긴다.
 */
export function PrintableResume({
  projectName,
  draft,
  review,
}: {
  projectName: string;
  draft: ResumeDraft;
  review: DraftReview;
}) {
  const { summary } = draft;
  const meta = [summary.period, summary.role, summary.techStack.join(', ')].filter(Boolean);

  return (
    <article data-print-root className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.title}>{projectName}</h1>
        <p className={styles.overview}>{summary.overview}</p>
        <p className={styles.meta}>{meta.join(' · ')}</p>
      </header>
      {keptAchievements(draft, review).map(achievement => (
        <section key={achievement.title} className={styles.achievement}>
          <h2 className={styles.achievementTitle}>{achievement.title}</h2>
          <ul className={styles.sentences}>
            {achievement.sentences.map((sentence, i) => (
              <li key={i}>
                <span className={styles.kind}>{SENTENCE_KIND_LABEL[sentence.kind]}</span>
                {sentence.text}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
