import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { Order } from '@/types/order';
import { ObjectId } from 'mongodb';

/**
 * Verify JWT token and check admin role
 */
function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: 'Missing or invalid authorization header' };
  }

  const token = authHeader.substring(7);
  const verificationResult = jwtHandler.verifyToken(token);

  if (!verificationResult.success || !verificationResult.payload) {
    return { success: false, error: verificationResult.error || 'Invalid token' };
  }

  if (verificationResult.payload.role !== 'admin') {
    return { success: false, error: 'Unauthorized: Admin access required' };
  }

  return { success: true, userId: verificationResult.payload.userId };
}

/**
 * GET /api/admin/reports/ordered-items
 * Generate ordered items report with detailed breakdown for each order item
 * Query params:
 *   - startDate (optional): Filter from date (ISO format)
 *   - endDate (optional): Filter to date (ISO format)
 *   - status (optional): Filter by order status (single or comma-separated list)
 *       Valid values: pending, confirmed, preparing, ready, out_for_delivery, delivered, cancelled
 *
 * Returns:
 *   - items: Array of ordered items with all details
 *   - startDate: Filter start date
 *   - endDate: Filter end date
 *   - totalRecords: Total number of items
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const statusParam = searchParams.get('status');

    // Valid order statuses
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];

    // Parse status parameter (comma-separated)
    let statusFilter: string[] = [];
    if (statusParam) {
      statusFilter = statusParam
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(s => validStatuses.includes(s));
    }

    // Build filter query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: any = {};

    // Filter by date range based on delivery dates in OrderDay array
    // Use string comparison like other working reports (delivery, kitchen)
    if (startDate || endDate) {
      const dateFilter: any = {};
      if (startDate) {
        dateFilter.$gte = startDate;
      }
      if (endDate) {
        dateFilter.$lte = endDate;
      }
      filter['items.deliveryDate'] = dateFilter;
    }

    // Filter by order status
    if (statusFilter.length > 0) {
      filter.status = { $in: statusFilter };
    }

    // Build aggregation pipeline for ordered items
    const orderedItemsPipeline = [
      // Match orders based on date filter
      ...(Object.keys(filter).length > 0 ? [{ $match: filter }] : []),
      // Unwind the items array (OrderDay array)
      { $unwind: '$items' },
      // Unwind the items.items array (OrderDayItem array)
      { $unwind: '$items.items' },
      // Project all required fields including combo data
      {
        $project: {
          _id: {
            $concat: [
              { $toString: '$_id' },
              '-',
              { $toString: '$items.deliveryDate' },
              '-',
              { $toString: '$items.items.food._id' }
            ]
          },
          orderId: '$orderId',
          orderDate: '$createdAt',
          deliveryDate: '$items.deliveryDate',
          customerName: '$customerInfo.name',
          customerPhone: '$customerInfo.phone',
          itemId: '$items.items.food._id',
          itemName: '$items.items.food.name',
          itemDescription: '$items.items.food.description',
          portionQuantity: { $ifNull: ['$items.items.selectedPortion', ''] },
          quantity: '$items.items.quantity',
          spiceLevel: { $ifNull: ['$items.items.spiceLevel', ''] },
          itemPrice: '$items.items.price',
          ecoContainer: { $ifNull: ['$items.items.isEcoFriendlyContainer', false] },
          ecoContainerAvailable: { $ifNull: ['$items.items.food.isEcoFriendlyContainer', false] },
          ecoContainerPrice: { $ifNull: ['$items.items.ecoContainerCharge', 0] },
          orderStatus: { $ifNull: ['$status', 'pending'] },
          // Include combo-related fields
          hasCombo: { $ifNull: ['$items.items.food.hasCombo', false] },
          comboSelections: { $ifNull: ['$items.items.comboSelections', null] },
          // Preserve the full sections array with complete item data
          sections: {
            $ifNull: [
              {
                $map: {
                  input: '$items.items.food.sections',
                  as: 'section',
                  in: {
                    _id: '$$section._id',
                    title: '$$section.title',
                    selectionType: '$$section.selectionType',
                    maxSelections: '$$section.maxSelections',
                    minSelections: '$$section.minSelections',
                    selectedItems: {
                      $map: {
                        input: '$$section.selectedItems',
                        as: 'selectedItem',
                        in: {
                          _id: '$$selectedItem._id',
                          item: {
                            _id: '$$selectedItem.item._id',
                            name: '$$selectedItem.item.name',
                            price: '$$selectedItem.item.price',
                            description: '$$selectedItem.item.description',
                          },
                          portion: '$$selectedItem.portion',
                          isDefault: '$$selectedItem.isDefault',
                        },
                      },
                    },
                  },
                },
              },
              []
            ]
          },
        },
      },
      // Sort by delivery date, then customer name, then item name
      {
        $sort: {
          deliveryDate: -1,
          customerName: 1,
          itemName: 1,
        },
      },
    ];

    // Execute aggregation
    const orderedItemsResult = await db.aggregate<Order>('orders', orderedItemsPipeline);

    if (!orderedItemsResult.success) {
      throw new Error(orderedItemsResult.error || 'Failed to generate ordered items report');
    }

    const items = orderedItemsResult.data || [];

    // Debug: Log combo items
    const comboItems = items.filter(item => item.hasCombo);
    console.log('=== COMBO DEBUG ===');
    console.log('Total items:', items.length);
    console.log('Combo items found:', comboItems.length);
    comboItems.forEach((item, idx) => {
      console.log(`\nCombo Item ${idx + 1}:`);
      console.log('  itemName:', item.itemName);
      console.log('  hasCombo:', item.hasCombo);
      console.log('  comboSelections:', JSON.stringify(item.comboSelections));
      console.log('  sections count:', item.sections?.length || 0);
      if (item.sections && item.sections.length > 0) {
        item.sections.forEach((section: any, sIdx: number) => {
          console.log(`  Section ${sIdx + 1}:`, section.title);
          console.log('    section._id:', section._id);
          console.log('    selectedItems count:', section.selectedItems?.length || 0);
          console.log('    comboSelections[section._id]:', item.comboSelections?.[section._id]);
        });
      }
    });
    console.log('=== END COMBO DEBUG ===\n');

    // Process combo items to expand selections into separate rows
    const processedItems = items.reduce((acc: any[], item: any) => {
      // Check if this is a combo item with selections
      // Note: sections might be an empty array if not populated, so we check hasCombo first
      if (item.hasCombo) {
        // For combo items, we need to expand them into separate rows for each selection
        // If sections data is available, use it to expand combo selections
        if (item.comboSelections && item.sections && item.sections.length > 0) {
          // Iterate through each section of the combo
          item.sections.forEach((section: any) => {
            // Convert section._id to string for lookup (comboSelections keys are strings)
            const sectionIdStr = section._id.toString();
            const selectedItemIds = item.comboSelections[sectionIdStr] || [];
            console.log(`Processing section: ${section.title}`);
            console.log('  selectedItemIds:', selectedItemIds);
            console.log('  section.selectedItems:', section.selectedItems.map((si: any) => ({ _id: si._id, name: si.item.name })));
            
            // Find selected items in this section
            const selectedItems = section.selectedItems.filter((si: any) => 
              selectedItemIds.includes(si._id)
            );
            console.log('  filtered selectedItems:', selectedItems.map((si: any) => ({ _id: si._id, name: si.item.name })));
            
            // If no selections made, use default items
            const itemsToProcess = selectedItems.length > 0 
              ? selectedItems 
              : section.selectedItems.filter((si: any) => si.isDefault);
            
            // Create a row for each selected/default item
            itemsToProcess.forEach((selectedItem: any) => {
              acc.push({
                _id: `${item._id}-${section._id}-${selectedItem._id}`,
                orderId: item.orderId,
                orderDate: item.orderDate,
                deliveryDate: item.deliveryDate,
                customerName: item.customerName,
                customerPhone: item.customerPhone,
                itemId: item.itemId,
                itemName: `${item.itemName}: ${selectedItem.item.name}`, // Prefix with combo name
                itemDescription: item.itemDescription,
                portionQuantity: selectedItem.portion || item.portionQuantity,
                quantity: item.quantity,
                spiceLevel: item.spiceLevel,
                itemPrice: item.itemPrice, // Use the combo item price
                ecoContainer: item.ecoContainer,
                ecoContainerAvailable: item.ecoContainerAvailable,
                ecoContainerPrice: item.ecoContainerPrice,
                orderStatus: item.orderStatus,
                hasCombo: true,
                isComboSelection: true,
                comboSectionTitle: section.title,
                comboItemName: selectedItem.item.name,
              });
            });
          });
        } else {
          // Combo item but no sections data, add as-is with combo name
          acc.push({
            ...item,
            isComboSelection: false,
          });
        }
      } else {
        // Not a combo item, add as-is
        acc.push({
          ...item,
          isComboSelection: false,
        });
      }
      
      return acc;
    }, []);

    // Calculate date range for response
    let responseStartDate = startDate;
    let responseEndDate = endDate;

    // If no date filter provided, use the date range from the data
    if (!responseStartDate && !responseEndDate && items.length > 0) {
      const dates = items.map(item => new Date(item.deliveryDate as string)).sort((a, b) => a.getTime() - b.getTime());
      responseStartDate = dates[0].toISOString().split('T')[0];
      responseEndDate = dates[dates.length - 1].toISOString().split('T')[0];
    }

    return NextResponse.json({
      data: {
        items: processedItems,
        startDate: responseStartDate || '',
        endDate: responseEndDate || '',
        totalRecords: processedItems.length,
      },
      message: 'Ordered items report generated successfully',
    });
  } catch (error) {
    console.error('Error in GET /api/admin/reports/ordered-items:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
