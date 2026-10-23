import type { HTMLAttributes, LiHTMLAttributes } from 'react';
import styles from './DividedList.module.css';

/** 테두리 안에서 항목 사이를 구분선으로 나눈 목록 */
export function DividedList({ className, ...rest }: HTMLAttributes<HTMLUListElement>) {
  return <ul className={[styles.list, className].filter(Boolean).join(' ')} {...rest} />;
}

export function DividedListItem({ className, ...rest }: LiHTMLAttributes<HTMLLIElement>) {
  return <li className={[styles.item, className].filter(Boolean).join(' ')} {...rest} />;
}
