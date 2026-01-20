'use client';

import { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  IconButton,
  Typography,
  Paper,
  Autocomplete,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Chip,
} from '@mui/material';
import { IconPlus, IconTrash, IconSearch, IconArrowUp, IconArrowDown } from '@tabler/icons-react';

interface FoodItem {
  _id: string;
  name: string;
  itemType: 'simple' | 'portions' | 'combo';
  portions?: string[];
  portionPrices?: number[];
  price?: number;
}

interface ComboItem {
  item: string; // item ID
  portion?: string;
  price: number;
  portionId: string;
  isDefault?: boolean;
  isAvailable?: boolean; // Individual item availability within combo
}

interface Section {
  title: string;
  selectedItems: ComboItem[];
}

interface ComboSectionManagerProps {
  sections: Section[];
  allFoodItems: FoodItem[];
  onChange: (sections: Section[]) => void;
  disabled?: boolean;
  error?: string;
}

export default function ComboSectionManager({
  sections,
  allFoodItems,
  onChange,
  disabled,
  error,
}: ComboSectionManagerProps) {
  const [expandedSection, setExpandedSection] = useState<number | null>(sections.length > 0 ? 0 : null);

  const handleAddSection = () => {
    const newSection: Section = {
      title: `Section ${sections.length + 1}`,
      selectedItems: [],
    };
    onChange([...sections, newSection]);
    setExpandedSection(sections.length);
  };

  const handleRemoveSection = (index: number) => {
    const newSections = sections.filter((_, i) => i !== index);
    onChange(newSections);
    if (expandedSection === index) {
      setExpandedSection(newSections.length > 0 ? 0 : null);
    }
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    const newSections = [...sections];
    if (direction === 'up' && index > 0) {
      // Swap with previous section
      [newSections[index - 1], newSections[index]] = [newSections[index], newSections[index - 1]];
      // Update expanded section to follow the moved section
      if (expandedSection === index) {
        setExpandedSection(index - 1);
      } else if (expandedSection === index - 1) {
        setExpandedSection(index);
      }
    } else if (direction === 'down' && index < sections.length - 1) {
      // Swap with next section
      [newSections[index], newSections[index + 1]] = [newSections[index + 1], newSections[index]];
      // Update expanded section to follow the moved section
      if (expandedSection === index) {
        setExpandedSection(index + 1);
      } else if (expandedSection === index + 1) {
        setExpandedSection(index);
      }
    }
    onChange(newSections);
  };

  const handleSectionTitleChange = (index: number, title: string) => {
    const newSections = [...sections];
    newSections[index] = { ...newSections[index], title };
    onChange(newSections);
  };

  const handleAddItemToSection = (sectionIndex: number, foodItem: FoodItem | null) => {
    if (!foodItem) return;

    const newSections = [...sections];
    const section = newSections[sectionIndex];

    // Check if item already exists in this section
    if (section.selectedItems.some((item) => item.item === foodItem._id)) {
      return; // Item already added
    }

    // Determine default portion and price
    let portion = '';
    let price = 0;
    let portionId = `${foodItem._id}-default`;

    if (foodItem.itemType === 'portions' && foodItem.portions && foodItem.portions.length > 0) {
      portion = foodItem.portions[0];
      price = foodItem.portionPrices?.[0] || 0;
      portionId = `${foodItem._id}-${portion}`;
    } else {
      price = foodItem.price || 0;
    }

    const newItem: ComboItem = {
      item: foodItem._id,
      portion,
      price,
      portionId,
      isDefault: false,
      isAvailable: true,
    };

    section.selectedItems.push(newItem);
    onChange(newSections);
  };

  const handleRemoveItemFromSection = (sectionIndex: number, itemIndex: number) => {
    const newSections = [...sections];
    newSections[sectionIndex].selectedItems = newSections[sectionIndex].selectedItems.filter(
      (_, i) => i !== itemIndex
    );
    onChange(newSections);
  };

  const handlePortionChange = (sectionIndex: number, itemIndex: number, portion: string) => {
    const newSections = [...sections];
    const item = newSections[sectionIndex].selectedItems[itemIndex];
    const foodItem = allFoodItems.find((f) => f._id === item.item);

    if (foodItem && foodItem.portions) {
      const portionIdx = foodItem.portions.indexOf(portion);
      const newPrice = foodItem.portionPrices?.[portionIdx] || 0;

      newSections[sectionIndex].selectedItems[itemIndex] = {
        ...item,
        portion,
        price: newPrice,
        portionId: `${item.item}-${portion}`,
      };
      onChange(newSections);
    }
  };

  const handlePriceChange = (sectionIndex: number, itemIndex: number, price: number) => {
    const newSections = [...sections];
    newSections[sectionIndex].selectedItems[itemIndex] = {
      ...newSections[sectionIndex].selectedItems[itemIndex],
      price,
    };
    onChange(newSections);
  };

  const handleDefaultToggle = (sectionIndex: number, itemIndex: number) => {
    const newSections = [...sections];
    const currentValue = newSections[sectionIndex].selectedItems[itemIndex].isDefault;
    newSections[sectionIndex].selectedItems[itemIndex] = {
      ...newSections[sectionIndex].selectedItems[itemIndex],
      isDefault: !currentValue,
    };
    onChange(newSections);
  };

  const handleAvailabilityToggle = (sectionIndex: number, itemIndex: number) => {
    const newSections = [...sections];
    const currentValue = newSections[sectionIndex].selectedItems[itemIndex].isAvailable ?? true;
    newSections[sectionIndex].selectedItems[itemIndex] = {
      ...newSections[sectionIndex].selectedItems[itemIndex],
      isAvailable: !currentValue,
    };
    onChange(newSections);
  };

  const getFoodItemById = (id: string): FoodItem | undefined => {
    return allFoodItems.find((item) => item._id === id);
  };

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600, color: '#374151' }}>
        Combo Sections *
      </Typography>
      <Typography variant="caption" sx={{ mb: 1.5, display: 'block', color: '#6B7280' }}>
        Items marked as &quot;Out of Stock&quot; will not be selectable by customers when ordering this combo.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {sections.map((section, sectionIndex) => (
          <Paper
            key={sectionIndex}
            elevation={0}
            sx={{
              border: '2px solid #E5E7EB',
              borderLeft: '4px solid #4F8CFF',
              borderRadius: 2,
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            }}
          >
            {/* Section Header */}
            <Box
              sx={{
                padding: 2,
                backgroundColor: expandedSection === sectionIndex ? '#F6FAFF' : '#F9FAFB',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
              }}
              onClick={() => setExpandedSection(expandedSection === sectionIndex ? null : sectionIndex)}
            >
              {/* Section Number Badge */}
              <Box
                sx={{
                  backgroundColor: '#4F8CFF',
                  color: '#fff',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: '14px',
                  mr: 2,
                  flexShrink: 0,
                }}
              >
                {sectionIndex + 1}
              </Box>

              <Box sx={{ flex: 1, mr: 2 }}>
                <TextField
                  value={section.title}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleSectionTitleChange(sectionIndex, e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Section Title (e.g., Main Course, Drinks)"
                  disabled={disabled}
                  size="small"
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#fff',
                      '&.Mui-focused fieldset': {
                        borderColor: '#4F8CFF',
                      },
                    },
                  }}
                />
              </Box>

              <Chip
                label={`${section.selectedItems.length} items`}
                size="small"
                sx={{
                  backgroundColor: '#E6F0FF',
                  color: '#4F8CFF',
                  fontWeight: 500,
                  mr: 1,
                }}
              />

              {/* Section Reorder Controls */}
              <Box sx={{ display: 'flex', gap: 0.5, mr: 0.5 }}>
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMoveSection(sectionIndex, 'up');
                  }}
                  disabled={disabled || sectionIndex === 0}
                  size="small"
                  sx={{
                    color: sectionIndex === 0 ? '#D1D5DB' : '#6B7280',
                    '&:hover': {
                      backgroundColor: '#F3F4F6',
                    },
                    '&.Mui-disabled': {
                      color: '#D1D5DB',
                    },
                  }}
                  title="Move section up"
                >
                  <IconArrowUp size={18} />
                </IconButton>
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMoveSection(sectionIndex, 'down');
                  }}
                  disabled={disabled || sectionIndex === sections.length - 1}
                  size="small"
                  sx={{
                    color: sectionIndex === sections.length - 1 ? '#D1D5DB' : '#6B7280',
                    '&:hover': {
                      backgroundColor: '#F3F4F6',
                    },
                    '&.Mui-disabled': {
                      color: '#D1D5DB',
                    },
                  }}
                  title="Move section down"
                >
                  <IconArrowDown size={18} />
                </IconButton>
              </Box>

              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveSection(sectionIndex);
                }}
                disabled={disabled}
                size="small"
                sx={{
                  color: '#EF4444',
                  '&:hover': {
                    backgroundColor: '#FEE2E2',
                  },
                }}
              >
                <IconTrash size={18} />
              </IconButton>
            </Box>

            {/* Section Content */}
            {expandedSection === sectionIndex && (
              <Box sx={{ padding: 2, backgroundColor: '#fff' }}>
                {/* Add Item Autocomplete */}
                <Box sx={{ mb: 2 }}>
                  <Autocomplete
                    options={allFoodItems}
                    getOptionLabel={(option) => option.name}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Search and add food items..."
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <>
                              <IconSearch size={18} style={{ marginLeft: 8, color: '#6B7280' }} />
                              {params.InputProps.startAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                    onChange={(_, value) => handleAddItemToSection(sectionIndex, value)}
                    disabled={disabled}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '&.Mui-focused fieldset': {
                          borderColor: '#4F8CFF',
                        },
                      },
                    }}
                  />
                </Box>

                {/* Selected Items */}
                {section.selectedItems.length === 0 ? (
                  <Box
                    sx={{
                      textAlign: 'center',
                      padding: 3,
                      backgroundColor: '#F9FAFB',
                      borderRadius: 2,
                      border: '1px dashed #D1D5DB',
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      No items added to this section yet
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {section.selectedItems.map((comboItem, itemIndex) => {
                      const foodItem = getFoodItemById(comboItem.item);
                      if (!foodItem) return null;

                      const isItemAvailable = comboItem.isAvailable ?? true;

                      return (
                        <Paper
                          key={itemIndex}
                          elevation={0}
                          sx={{
                            padding: 1.5,
                            border: isItemAvailable ? '1px solid #E5E7EB' : '1px solid #FCA5A5',
                            borderRadius: 1.5,
                            backgroundColor: isItemAvailable ? '#FAFBFC' : '#FEF2F2',
                            opacity: isItemAvailable ? 1 : 0.7,
                            transition: 'all 0.2s ease-in-out',
                          }}
                        >
                          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                            {/* Item Name */}
                            <Box sx={{ flex: '1 1 200px', minWidth: 150 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: 600,
                                    color: isItemAvailable ? '#111827' : '#9CA3AF',
                                    textDecoration: isItemAvailable ? 'none' : 'line-through',
                                  }}
                                >
                                  {foodItem.name}
                                </Typography>
                                {!isItemAvailable && (
                                  <Chip
                                    label="Unavailable"
                                    size="small"
                                    sx={{
                                      height: 20,
                                      fontSize: '10px',
                                      backgroundColor: '#FEE2E2',
                                      color: '#EF4444',
                                      fontWeight: 600,
                                    }}
                                  />
                                )}
                              </Box>
                              <Typography variant="caption" sx={{ color: '#6B7280' }}>
                                {foodItem.itemType}
                              </Typography>
                            </Box>

                            {/* Portion Selector (if applicable) */}
                            {foodItem.itemType === 'portions' && foodItem.portions && (
                              <Box sx={{ flex: '0 0 150px' }}>
                                <Select
                                  value={comboItem.portion || ''}
                                  onChange={(e) =>
                                    handlePortionChange(sectionIndex, itemIndex, e.target.value)
                                  }
                                  disabled={disabled}
                                  size="small"
                                  fullWidth
                                  sx={{
                                    backgroundColor: '#fff',
                                    '& .MuiOutlinedInput-notchedOutline': {
                                      borderColor: '#D1D5DB',
                                    },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                      borderColor: '#4F8CFF',
                                    },
                                  }}
                                >
                                  {foodItem.portions.map((portion, idx) => (
                                    <MenuItem key={idx} value={portion}>
                                      {portion} - ${foodItem.portionPrices?.[idx] || 0}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </Box>
                            )}

                            {/* Additional Price */}
                            <Box sx={{ flex: '0 0 120px' }}>
                              <TextField
                                label="Price ($)"
                                type="number"
                                value={comboItem.price}
                                onChange={(e) =>
                                  handlePriceChange(sectionIndex, itemIndex, parseFloat(e.target.value) || 0)
                                }
                                disabled={disabled}
                                size="small"
                                inputProps={{ min: 0, step: 0.01 }}
                                fullWidth
                                sx={{
                                  '& .MuiOutlinedInput-root': {
                                    backgroundColor: '#fff',
                                    '&.Mui-focused fieldset': {
                                      borderColor: '#4F8CFF',
                                    },
                                  },
                                }}
                              />
                            </Box>

                            {/* Default Toggle */}
                            <Box sx={{ flex: '0 0 100px' }}>
                              <FormControlLabel
                                control={
                                  <Switch
                                    checked={comboItem.isDefault || false}
                                    onChange={() => handleDefaultToggle(sectionIndex, itemIndex)}
                                    disabled={disabled}
                                    size="small"
                                    sx={{
                                      '& .MuiSwitch-switchBase.Mui-checked': {
                                        color: '#4F8CFF',
                                      },
                                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                        backgroundColor: '#4F8CFF',
                                      },
                                    }}
                                  />
                                }
                                label={
                                  <Typography variant="caption" sx={{ fontSize: '11px' }}>
                                    Default
                                  </Typography>
                                }
                              />
                            </Box>

                            {/* Availability Toggle */}
                            <Box sx={{ flex: '0 0 110px' }}>
                              <FormControlLabel
                                control={
                                  <Switch
                                    checked={isItemAvailable}
                                    onChange={() => handleAvailabilityToggle(sectionIndex, itemIndex)}
                                    disabled={disabled}
                                    size="small"
                                    sx={{
                                      '& .MuiSwitch-switchBase.Mui-checked': {
                                        color: '#10B981',
                                      },
                                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                        backgroundColor: '#10B981',
                                      },
                                      '& .MuiSwitch-switchBase': {
                                        color: '#EF4444',
                                      },
                                      '& .MuiSwitch-track': {
                                        backgroundColor: '#FCA5A5',
                                      },
                                    }}
                                  />
                                }
                                label={
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontSize: '11px',
                                      color: isItemAvailable ? '#10B981' : '#EF4444',
                                      fontWeight: 500,
                                    }}
                                  >
                                    {isItemAvailable ? 'Available' : 'Out of Stock'}
                                  </Typography>
                                }
                              />
                            </Box>

                            {/* Remove Button */}
                            <IconButton
                              onClick={() => handleRemoveItemFromSection(sectionIndex, itemIndex)}
                              disabled={disabled}
                              size="small"
                              sx={{
                                color: '#EF4444',
                                '&:hover': {
                                  backgroundColor: '#FEE2E2',
                                },
                              }}
                            >
                              <IconTrash size={16} />
                            </IconButton>
                          </Box>
                        </Paper>
                      );
                    })}
                  </Box>
                )}
              </Box>
            )}
          </Paper>
        ))}
      </Box>

      <Button
        startIcon={<IconPlus size={18} />}
        onClick={handleAddSection}
        disabled={disabled}
        sx={{
          mt: 2,
          textTransform: 'none',
          color: '#4F8CFF',
          borderColor: '#4F8CFF',
          '&:hover': {
            borderColor: '#3B7AE8',
            backgroundColor: 'rgba(79, 140, 255, 0.04)',
          },
        }}
        variant="outlined"
      >
        Add New Section
      </Button>

      {error && (
        <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}
