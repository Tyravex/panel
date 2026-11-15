import type { EggTag } from '@shared/types';
import { useTranslation } from 'react-i18next';

export const eggTagStyles = {
  violet: 'border-violet-400/30 bg-violet-400/10 text-violet-300', blue: 'border-blue-400/30 bg-blue-400/10 text-blue-300',
  cyan: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300', green: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  amber: 'border-amber-400/30 bg-amber-400/10 text-amber-300', rose: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
  slate: 'border-slate-400/30 bg-slate-400/10 text-slate-300',
};
export const EggTagBadge = ({ tag }: { tag: EggTag }) => {
  const { t } = useTranslation();
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${eggTagStyles[tag.color] ?? eggTagStyles.slate}`} title={t(tag.system ? 'eggs.systemTag' : tag.ownerId === null ? 'eggs.sharedTag' : 'eggs.personalTag')}>
    {tag.system ? t(`eggs.systemTags.${tag.id.slice(7)}`, { defaultValue: tag.name }) : tag.name}
  </span>;
};
