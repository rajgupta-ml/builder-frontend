const parseBoolFlag = (raw: string | undefined, defaultValue: boolean): boolean => {
  if (raw === undefined) return defaultValue;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
};

const resolveHideFlag = (
  hideRaw: string | undefined,
  showRaw: string | undefined,
  defaultHide = false
): boolean => {
  if (hideRaw === undefined && showRaw === undefined) return defaultHide;
  const hide = parseBoolFlag(hideRaw, false);
  const show = parseBoolFlag(showRaw, true);
  return hide || !show;
};

export const featureFlags = {
  hideAiQuestionImporter: resolveHideFlag(
    process.env.NEXT_PUBLIC_FF_HIDE_AI_QUESTION_IMPORTER,
    process.env.NEXT_PUBLIC_FF_AI_QUESTION_IMPORTER
  ),
  hideMediaInteractionText: resolveHideFlag(
    process.env.NEXT_PUBLIC_FF_HIDE_MEDIA_INTERACTION_TEXT,
    process.env.NEXT_PUBLIC_FF_MEDIA_INTERACTION_TEXT
  ),
  hideMediaInteractionRating: resolveHideFlag(
    process.env.NEXT_PUBLIC_FF_HIDE_MEDIA_INTERACTION_RATING,
    process.env.NEXT_PUBLIC_FF_MEDIA_INTERACTION_RATING
  ),
  hideMediaInteractionChoice: resolveHideFlag(
    process.env.NEXT_PUBLIC_FF_HIDE_MEDIA_INTERACTION_CHOICE,
    process.env.NEXT_PUBLIC_FF_MEDIA_INTERACTION_CHOICE,
    true
  ),
} as const;
