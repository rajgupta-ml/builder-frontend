import React, { useState } from 'react';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface EmojiPickerProps {
    value: { label: string; value: string }[];
    onChange: (value: { label: string; value: string }[]) => void;
}

const EMOJI_CATEGORIES = {
    'Emotions': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '😶‍🌫️', '🥴', '😵', '😵‍💫', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️'],
    'Gestures': ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶'],
    'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'],
    'Symbols': ['✅', '❌', '⭐', '🌟', '💫', '✨', '⚡', '🔥', '💥', '💯', '🎯', '🎪', '🎨', '🎭', '🎬', '🎤', '🎧', '🎵', '🎶', '🎹', '🎺', '🎸', '🎻', '🥁'],
    'Animals': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔'],
    'Food': ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🧆', '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕', '🍵', '🧃', '🥤', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊'],
};

export default function EmojiPicker({ value, onChange }: EmojiPickerProps) {
    const [showPicker, setShowPicker] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<keyof typeof EMOJI_CATEGORIES>('Emotions');

    const addEmoji = (emoji: string) => {
        const newOption = {
            label: '', // User can edit this later
            value: emoji
        };
        onChange([...(value || []), newOption]);
        setShowPicker(false);
    };

    const removeEmoji = (index: number) => {
        const newOptions = value.filter((_, i) => i !== index);
        onChange(newOptions);
    };

    const updateLabel = (index: number, label: string) => {
        const newOptions = [...value];
        newOptions[index] = { ...newOptions[index], label };
        onChange(newOptions);
    };

    return (
        <div className="space-y-3">
            {/* Selected Emojis */}
            <div className="space-y-2">
                {(value || []).map((option, index) => (
                    <div key={index} className="flex gap-2 items-center">
                        <div className="w-12 h-12 flex items-center justify-center text-3xl bg-muted rounded-md border border-border shrink-0">
                            {option.value}
                        </div>
                        <input
                            type="text"
                            value={option.label}
                            onChange={(e) => updateLabel(index, e.target.value)}
                            className="flex-1 px-3 py-2 text-sm bg-background border border-input rounded-md"
                            placeholder="Label (optional)"
                        />
                        <button
                            onClick={() => removeEmoji(index)}
                            className="p-2 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        >
                            <IconTrash size={14} />
                        </button>
                    </div>
                ))}
            </div>

            {/* Add Emoji Button */}
            <button
                onClick={() => setShowPicker(!showPicker)}
                className="flex items-center gap-2 text-xs text-primary hover:underline"
            >
                <IconPlus size={14} />
                Add Emoji
            </button>

            {/* Emoji Picker Popup */}
            {showPicker && (
                <div className="border border-border rounded-lg bg-background shadow-lg p-3 space-y-3">
                    {/* Category Tabs */}
                    <div className="flex gap-1 overflow-x-auto pb-2 border-b border-border">
                        {Object.keys(EMOJI_CATEGORIES).map((category) => (
                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category as keyof typeof EMOJI_CATEGORIES)}
                                className={cn(
                                    "px-3 py-1 text-xs rounded-md transition-colors whitespace-nowrap",
                                    selectedCategory === category
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                                )}
                            >
                                {category}
                            </button>
                        ))}
                    </div>

                    {/* Emoji Grid */}
                    <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                        {EMOJI_CATEGORIES[selectedCategory].map((emoji, idx) => (
                            <button
                                key={idx}
                                onClick={() => addEmoji(emoji)}
                                className="w-8 h-8 flex items-center justify-center text-xl hover:bg-muted rounded transition-colors"
                                title={emoji}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
