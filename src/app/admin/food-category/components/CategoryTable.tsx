"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Chip,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import {
  IconDotsVertical,
  IconEdit,
  IconListDetails,
  IconSortDescending,
  IconTrash,
} from "@tabler/icons-react";
import { FoodCategory } from "@/types/order";
import { CategoryGroup, categoryTableRows } from "@/utils/categoryTree";

interface CategoryTableProps {
  groups: CategoryGroup<FoodCategory>[];
  onEdit: (category: FoodCategory) => void;
  onDelete: (category: FoodCategory) => void;
  onItemSequence: (category: FoodCategory) => void;
}

const COLUMN_WIDTH = 220;
const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400";
const BORDER = "1px solid #E5E7EB";

const typeColor = (category: FoodCategory) =>
  category.listingType === "day-wise" ? "#8B5CF6" : "#10B981";
const typeLabel = (category: FoodCategory) =>
  category.listingType === "day-wise" ? "Day-wise" : "Flat";

function itemCountOf(category: FoodCategory): number {
  if (category.itemCount !== undefined) return category.itemCount;
  if (category.listingType === "day-wise" && category.dayWiseItems) {
    return category.dayWiseItems.reduce(
      (total, day) => total + day.items.length,
      0,
    );
  }
  return 0;
}

/** One category or sub-category: name, rank, type, item count, and the same actions menu the cards had. */
function CategoryEntry({
  category,
  isTop,
  onEdit,
  onDelete,
  onItemSequence,
}: { category: FoodCategory; isTop: boolean } & Pick<
  CategoryTableProps,
  "onEdit" | "onDelete" | "onItemSequence"
>) {
  const router = useRouter();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const count = isTop ? itemCountOf(category) : 0;
  const close = () => setAnchor(null);
  const manageItems = () =>
    router.push(`/admin/food-category/${category._id?.toString()}/items`);

  return (
    <Box
      onClick={() => onEdit(category)}
      title={category.description || undefined}
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1,
        cursor: "pointer",
      }}
    >
      {isTop && (
        <Box
          role="img"
          aria-label={category.name}
          sx={{
            width: "100%",
            height: 96,
            borderRadius: 1.5,
            backgroundColor: "#FFF4E4",
            backgroundImage: `url("${category.url || DEFAULT_IMAGE}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        {!isTop && (
          <Box
            role="img"
            aria-label={category.name}
            sx={{
              width: 44,
              height: 44,
              flexShrink: 0,
              borderRadius: 1,
              backgroundColor: "#FFF4E4",
              backgroundImage: `url("${category.url || DEFAULT_IMAGE}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        )}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            sx={{
              fontWeight: isTop ? 700 : 500,
              fontSize: isTop ? 15 : 14,
              color: "#111827",
              lineHeight: 1.3,
              wordBreak: "break-word",
            }}
          >
            {category.name}
            {category.isDraft ? (
              <Typography
                component="span"
                sx={{ fontSize: 12, color: "#B45309", ml: 0.75 }}
              >
                (draft)
              </Typography>
            ) : null}
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
            <Chip
              size="small"
              label={`#${category.sequence || 0}`}
              sx={{
                height: 20,
                fontSize: 11,
                bgcolor: "#EEF2FF",
                color: "#4F8CFF",
                fontWeight: 600,
              }}
            />
            <Chip
              size="small"
              label={typeLabel(category)}
              sx={{
                height: 20,
                fontSize: 11,
                bgcolor: typeColor(category),
                color: "#fff",
                fontWeight: 600,
              }}
            />
            {isTop && count > 0 && (
              <Chip
                size="small"
                label={`${count} ${count === 1 ? "item" : "items"}`}
                onClick={(e) => {
                  e.stopPropagation();
                  manageItems();
                }}
                sx={{
                  height: 20,
                  fontSize: 11,
                  bgcolor: "#F59E0B",
                  color: "#fff",
                  fontWeight: 600,
                  "&:hover": { bgcolor: "#D97706" },
                }}
              />
            )}
          </Box>
        </Box>
        <IconButton
          size="small"
          aria-label={`Actions for ${category.name}`}
          onClick={(e) => {
            e.stopPropagation();
            setAnchor(e.currentTarget);
          }}
          sx={{ mt: -0.5, mr: -0.75, color: "#4F8CFF", flexShrink: 0 }}
        >
          <IconDotsVertical size={18} />
        </IconButton>
        <Menu
          anchorEl={anchor}
          open={Boolean(anchor)}
          onClose={close}
          onClick={(e) => e.stopPropagation()}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          {isTop && (
            <MenuItem
              onClick={() => {
                close();
                manageItems();
              }}
              sx={{ gap: 1.5 }}
            >
              <ListItemIcon>
                <IconListDetails size={18} />
              </ListItemIcon>
              Manage Category Items
            </MenuItem>
          )}
          {isTop && (
            <MenuItem
              onClick={() => {
                close();
                onItemSequence(category);
              }}
              sx={{ gap: 1.5 }}
            >
              <ListItemIcon>
                <IconSortDescending size={18} />
              </ListItemIcon>
              Item Sequence
            </MenuItem>
          )}
          <MenuItem
            onClick={() => {
              close();
              onEdit(category);
            }}
            sx={{ gap: 1.5 }}
          >
            <ListItemIcon>
              <IconEdit size={18} />
            </ListItemIcon>
            Edit
          </MenuItem>
          <MenuItem
            onClick={() => {
              close();
              onDelete(category);
            }}
            sx={{ gap: 1.5, color: "#FF7675" }}
          >
            <ListItemIcon>
              <IconTrash size={18} color="#FF7675" />
            </ListItemIcon>
            Delete
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}

/**
 * Food categories as a table: one column per category (in rank order), its sub-categories listed
 * underneath in rank order. The first column holds the row labels and stays in view when the table
 * scrolls sideways (many categories, or a phone).
 */
export default function CategoryTable({
  groups,
  onEdit,
  onDelete,
  onItemSequence,
}: CategoryTableProps) {
  const rows = categoryTableRows(groups);
  const labelCell = {
    position: "sticky" as const,
    left: 0,
    zIndex: 1,
    bgcolor: "#F9FAFB",
    width: { xs: 92, sm: 120 },
    minWidth: { xs: 92, sm: 120 },
    px: { xs: 1, sm: 2 },
    fontWeight: 700,
    fontSize: { xs: 12.5, sm: 14 },
    color: "#374151",
    borderRight: BORDER,
    verticalAlign: "top" as const,
  };

  return (
    <TableContainer
      sx={{
        border: BORDER,
        borderRadius: 2,
        bgcolor: "#fff",
        maxWidth: "100%",
      }}
    >
      <Table
        size="small"
        sx={{ width: "max-content", minWidth: "100%", tableLayout: "fixed" }}
      >
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...labelCell, borderBottom: "2px solid #111827" }}>
              Categories
            </TableCell>
            {groups.map((group) => (
              <TableCell
                key={group.parentId}
                sx={{
                  width: COLUMN_WIDTH,
                  minWidth: COLUMN_WIDTH,
                  verticalAlign: "top",
                  borderBottom: "2px solid #111827",
                  borderRight: BORDER,
                  py: 1.5,
                }}
              >
                {group.parent ? (
                  <CategoryEntry
                    category={group.parent}
                    isTop
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onItemSequence={onItemSequence}
                  />
                ) : (
                  <Typography
                    sx={{ fontSize: 13, color: "#6B7280", fontStyle: "italic" }}
                  >
                    {group.parentName
                      ? `${group.parentName} (hidden by the filter)`
                      : "Parent not found"}
                  </Typography>
                )}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell sx={labelCell}>Subcategories</TableCell>
              <TableCell
                colSpan={Math.max(1, groups.length)}
                sx={{ color: "#9CA3AF", fontSize: 13 }}
              >
                No sub-categories yet.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, r) => (
              <TableRow key={r}>
                <TableCell
                  sx={{
                    ...labelCell,
                    color: r === 0 ? "#374151" : "transparent",
                    borderBottom: r === rows.length - 1 ? "none" : BORDER,
                  }}
                >
                  {r === 0 ? "Subcategories" : ""}
                </TableCell>
                {row.map((sub, c) => (
                  <TableCell
                    key={groups[c].parentId}
                    sx={{
                      verticalAlign: "top",
                      borderRight: BORDER,
                      borderBottom: r === rows.length - 1 ? "none" : BORDER,
                      py: 1.25,
                    }}
                  >
                    {sub && (
                      <CategoryEntry
                        category={sub}
                        isTop={false}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onItemSequence={onItemSequence}
                      />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
