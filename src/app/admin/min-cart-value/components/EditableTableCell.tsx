'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  TextField,
  Typography,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import { IconEdit } from '@tabler/icons-react';

export type FieldType = 'text' | 'number' | 'zipcode' | 'label';

export interface ValidationRule {
  type: FieldType;
  required?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  pattern?: RegExp;
  patternMessage?: string;
}

export interface EditableTableCellProps {
  value: string | number;
  fieldType: FieldType;
  validationRule?: ValidationRule;
  isEditing: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (value: string | number) => Promise<void>;
  placeholder?: string;
  displayFormatter?: (value: string | number) => string;
}

const defaultValidationRules: Record<FieldType, ValidationRule> = {
  zipcode: {
    type: 'zipcode',
    required: true,
    pattern: /^\d{5}(-\d{4})?$/,
    patternMessage: 'Invalid zipcode format. Use 5 digits (12345) or 5+4 digits (12345-6789)',
  },
  label: {
    type: 'label',
    required: false,
    maxLength: 50,
  },
  number: {
    type: 'number',
    required: true,
    min: 0,
  },
  text: {
    type: 'text',
    required: false,
  },
};

export default function EditableTableCell({
  value,
  fieldType,
  validationRule,
  isEditing,
  isLoading = false,
  disabled = false,
  onStartEdit,
  onCancelEdit,
  onSave,
  placeholder,
  displayFormatter,
}: EditableTableCellProps) {
  const [editValue, setEditValue] = useState<string>(String(value ?? ''));
  const [error, setError] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cellRef = useRef<HTMLDivElement>(null);

  // Get validation rule (use provided or default based on field type)
  const rule = validationRule || defaultValidationRules[fieldType];

  // Reset edit value when entering edit mode or value changes externally
  useEffect(() => {
    if (isEditing) {
      // Defer state updates to avoid cascading renders warning
      queueMicrotask(() => {
        setEditValue(String(value ?? ''));
        setError('');
      });
    }
  }, [isEditing, value]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const validate = useCallback((val: string): string | null => {
    const trimmedValue = val.trim();

    // Required check
    if (rule.required && !trimmedValue) {
      return 'This field is required';
    }

    // Skip further validation if empty and not required
    if (!trimmedValue) {
      return null;
    }

    // Pattern validation (for zipcode)
    if (rule.pattern && !rule.pattern.test(trimmedValue)) {
      return rule.patternMessage || 'Invalid format';
    }

    // Max length validation (for label)
    if (rule.maxLength && trimmedValue.length > rule.maxLength) {
      return `Maximum ${rule.maxLength} characters allowed`;
    }

    // Number validation
    if (fieldType === 'number') {
      const numValue = parseFloat(trimmedValue);
      if (isNaN(numValue)) {
        return 'Must be a valid number';
      }
      if (rule.min !== undefined && numValue < rule.min) {
        return `Value must be at least ${rule.min}`;
      }
      if (rule.max !== undefined && numValue > rule.max) {
        return `Value must be at most ${rule.max}`;
      }
    }

    return null;
  }, [rule, fieldType]);

  const handleSave = useCallback(async () => {
    const validationError = validate(editValue);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const finalValue = fieldType === 'number'
        ? parseFloat(editValue.trim())
        : editValue.trim();

      await onSave(finalValue);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setIsSaving(false);
    }
  }, [editValue, validate, fieldType, onSave]);

  const handleCancel = useCallback(() => {
    setEditValue(String(value ?? ''));
    setError('');
    onCancelEdit();
  }, [value, onCancelEdit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  }, [handleSave, handleCancel]);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Check if focus is moving outside the cell
    if (cellRef.current && !cellRef.current.contains(e.relatedTarget as Node)) {
      // Only save if value has changed
      if (editValue.trim() !== String(value ?? '').trim()) {
        handleSave();
      } else {
        handleCancel();
      }
    }
  }, [editValue, value, handleSave, handleCancel]);

  const handleDoubleClick = useCallback(() => {
    if (!disabled && !isLoading) {
      onStartEdit();
    }
  }, [disabled, isLoading, onStartEdit]);

  const displayValue = displayFormatter
    ? displayFormatter(value)
    : String(value ?? '-');

  const showLoading = isLoading || isSaving;

  // Edit mode
  if (isEditing) {
    return (
      <Box ref={cellRef} sx={{ position: 'relative', minWidth: 80 }}>
        <TextField
          inputRef={inputRef}
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            if (error) setError('');
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={showLoading}
          error={!!error}
          helperText={error}
          size="small"
          type={fieldType === 'number' ? 'number' : 'text'}
          placeholder={placeholder}
          inputProps={{
            ...(fieldType === 'number' && { min: rule.min, step: 0.01 }),
            ...(rule.maxLength && { maxLength: rule.maxLength }),
          }}
          sx={{
            width: '100%',
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#F6FAFF',
              fontSize: '14px',
              '& input': {
                padding: '8px 12px',
              },
              '&:hover fieldset': {
                borderColor: '#4F8CFF',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#4F8CFF',
              },
              '&.Mui-error fieldset': {
                borderColor: '#EF4444',
              },
            },
            '& .MuiFormHelperText-root': {
              position: 'absolute',
              bottom: -20,
              left: 0,
              margin: 0,
              fontSize: '11px',
              whiteSpace: 'nowrap',
            },
          }}
          InputProps={{
            endAdornment: showLoading ? (
              <CircularProgress size={16} sx={{ color: '#4F8CFF' }} />
            ) : null,
          }}
        />
      </Box>
    );
  }

  // Display mode
  return (
    <Tooltip title="Double-click to edit" arrow placement="top" enterDelay={500}>
      <Box
        ref={cellRef}
        onDoubleClick={handleDoubleClick}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          padding: '4px 8px',
          margin: '-4px -8px',
          borderRadius: 1,
          cursor: disabled ? 'default' : 'pointer',
          transition: 'background-color 0.15s ease',
          '&:hover': disabled ? {} : {
            backgroundColor: '#E6F0FF',
            '& .edit-icon': {
              opacity: 1,
            },
          },
        }}
      >
        <Typography
          sx={{
            fontSize: '14px',
            color: value ? '#374151' : '#9CA3AF',
            flex: 1,
          }}
        >
          {displayValue}
        </Typography>
        {!disabled && (
          <IconEdit
            size={14}
            className="edit-icon"
            style={{
              color: '#9CA3AF',
              opacity: 0,
              transition: 'opacity 0.15s ease',
              flexShrink: 0,
            }}
          />
        )}
      </Box>
    </Tooltip>
  );
}
