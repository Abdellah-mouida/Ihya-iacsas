"use client";

import React, { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ProfileTagEditorProps {
  label: string;
  helperText?: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  maxTags: number;
  maxTagLength?: number;
  presets?: string[];
  placeholder?: string;
  testIdPrefix: string;
  disabled?: boolean;
}

export function ProfileTagEditor({
  label,
  helperText,
  tags,
  onChange,
  maxTags,
  maxTagLength = 30,
  presets = [],
  placeholder = "",
  testIdPrefix,
  disabled = false,
}: ProfileTagEditorProps) {
  const [inputValue, setInputValue] = useState("");

  const handleAddTag = (tagToAdd?: string) => {
    if (disabled) return;
    const raw = (tagToAdd !== undefined ? tagToAdd : inputValue).trim();
    if (!raw) return;

    const clean = raw.slice(0, maxTagLength);
    if (tags.length >= maxTags) return;
    if (tags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setInputValue("");
      return;
    }

    onChange([...tags, clean]);
    setInputValue("");
  };

  const handleRemoveTag = (indexToRemove: number) => {
    if (disabled) return;
    onChange(tags.filter((_, i) => i !== indexToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      e.stopPropagation();
      handleAddTag();
    }
  };

  const togglePreset = (preset: string) => {
    if (disabled) return;
    const exists = tags.some((t) => t.toLowerCase() === preset.toLowerCase());
    if (exists) {
      onChange(tags.filter((t) => t.toLowerCase() !== preset.toLowerCase()));
    } else {
      if (tags.length < maxTags) {
        onChange([...tags, preset]);
      }
    }
  };

  return (
    <div className="space-y-2.5" data-testid={`${testIdPrefix}-container`}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-foreground">
          {label}
        </label>
        <span
          className="text-xs text-muted-foreground font-mono"
          data-testid={`${testIdPrefix}-count`}
        >
          {tags.length} / {maxTags}
        </span>
      </div>

      {helperText && (
        <p className="text-xs text-muted-foreground -mt-1">{helperText}</p>
      )}

      {/* Selected Tags */}
      <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 rounded-xl bg-muted/20 border border-border/50">
        {tags.length === 0 ? (
          <span className="text-xs text-muted-foreground/60 italic py-1 px-1">
            —
          </span>
        ) : (
          tags.map((tag, idx) => (
            <span
              key={`${tag}-${idx}`}
              data-testid={`${testIdPrefix}-tag-${idx}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-colors"
            >
              <span>{tag}</span>
              {!disabled && (
                <button
                  type="button"
                  data-testid={`${testIdPrefix}-remove-btn-${idx}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRemoveTag(idx);
                  }}
                  className="rounded hover:bg-primary/20 p-0.5 text-primary hover:text-foreground transition-colors"
                  aria-label={`Remove ${tag}`}
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))
        )}
      </div>

      {/* Input row */}
      {tags.length < maxTags && !disabled && (
        <div className="flex gap-2">
          <Input
            data-testid={`${testIdPrefix}-input`}
            value={inputValue}
            maxLength={maxTagLength}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="rounded-xl h-10 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid={`${testIdPrefix}-add-btn`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleAddTag();
            }}
            disabled={!inputValue.trim()}
            className="rounded-xl h-10 px-3 shrink-0 flex items-center gap-1"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      )}

      {/* Presets */}
      {presets.length > 0 && !disabled && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {presets.map((preset) => {
            const isSelected = tags.some(
              (t) => t.toLowerCase() === preset.toLowerCase(),
            );
            return (
              <button
                key={preset}
                type="button"
                data-testid={`${testIdPrefix}-preset-${preset}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  togglePreset(preset);
                }}
                disabled={!isSelected && tags.length >= maxTags}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground disabled:opacity-40"
                }`}
              >
                {isSelected ? `✓ ${preset}` : `+ ${preset}`}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
