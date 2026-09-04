export type ChoiceOption = { label: string; value: string };

export const titleCase = (value: string): string => value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getOptionValue = (option: unknown): string => {
    const record = option as Record<string, unknown> | null;
    return String(record?.value || "").trim();
};

export const getChoiceOptions = (data?: Record<string, unknown>): ChoiceOption[] => {
    const options = Array.isArray(data?.options) ? data.options : [];
    const baseOptions = options
        .map((option) => {
            const record = option as Record<string, unknown>;
            const value = getOptionValue(record);
            if (!value) return null;
            return { label: String(record.label || value), value };
        })
        .filter((option): option is ChoiceOption => Boolean(option));

    if (data?.allowOther) {
        baseOptions.push({ label: String(data.otherLabel || "Other"), value: "other" });
    }
    if (data?.allowNone) {
        baseOptions.push({ label: String(data.noneLabel || "None of these"), value: "none" });
    }

    return baseOptions;
};
