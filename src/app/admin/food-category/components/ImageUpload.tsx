'use client';

import { useRef, useState } from 'react';
import { Box, Button, Typography, Avatar } from '@mui/material';
import { IconUpload, IconPhoto } from '@tabler/icons-react';

interface ImageUploadProps {
  value: string | null;
  onChange: (file: File | null, previewUrl: string | null) => void;
  disabled?: boolean;
}

export default function ImageUpload({ value, onChange, disabled }: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(value);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }

      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);
      onChange(file, previewUrl);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onChange(null, null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Box>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        disabled={disabled}
      />

      {preview ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Avatar
            src={preview}
            alt="Category preview"
            sx={{
              width: 150,
              height: 150,
              border: '3px solid #4F8CFF',
            }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={handleButtonClick}
              disabled={disabled}
              sx={{
                textTransform: 'none',
                borderColor: '#4F8CFF',
                color: '#4F8CFF',
                '&:hover': {
                  borderColor: '#3B7AE8',
                  backgroundColor: 'rgba(79, 140, 255, 0.04)',
                },
              }}
            >
              Change Image
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={handleRemove}
              disabled={disabled}
              sx={{
                textTransform: 'none',
              }}
            >
              Remove
            </Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 150,
              height: 150,
              borderRadius: '50%',
              backgroundColor: '#F6FAFF',
              border: '2px dashed #4F8CFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconPhoto size={48} color="#4F8CFF" opacity={0.5} />
          </Box>
          <Button
            variant="contained"
            startIcon={<IconUpload size={18} />}
            onClick={handleButtonClick}
            disabled={disabled}
            sx={{
              textTransform: 'none',
              backgroundColor: '#4F8CFF',
              '&:hover': {
                backgroundColor: '#3B7AE8',
              },
            }}
          >
            Upload Image
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
            Recommended: Square image, max 5MB
            <br />
            Supported formats: JPG, PNG, GIF
          </Typography>
        </Box>
      )}
    </Box>
  );
}
