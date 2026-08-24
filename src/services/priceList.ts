import type { Cr720_wfrdpricelists } from '../generated/models/Cr720_wfrdpricelistsModel';
import { Cr720_wfrdpricelistsService } from '../generated/services/Cr720_wfrdpricelistsService';

export interface PriceListItem {
  id: string; itemNumber: number | null; partNumber: string; description: string;
  classification: string; leadTimeDays: number | null; unitPrice: number; productLine: string;
  customer: string; country: string; contractNumber: string;
}

function mapItem(record: Cr720_wfrdpricelists): PriceListItem {
  return {
    id: record.cr720_wfrdpricelistid,
    itemNumber: record.cr720_item ?? null,
    partNumber: record.cr720_wfrdpn?.trim() || record.cr720_id?.trim() || 'No part number',
    description: record.cr720_description?.trim() || 'Untitled item',
    classification: record.cr720_classification?.trim() || 'Not classified',
    leadTimeDays: record.cr720_leadtimeday ?? null,
    unitPrice: record.cr720_unitpriceusd ?? 0,
    productLine: record.cr720_plname?.trim() || '',
    customer: record.cr720_customer?.trim() || '',
    country: record.cr720_country?.trim() || '',
    contractNumber: record.cr720_contractnumber?.trim() || '',
  };
}

export async function getMpdPriceList(): Promise<PriceListItem[]> {
  const result = await Cr720_wfrdpricelistsService.getAll({
    select: ['cr720_wfrdpricelistid', 'cr720_item', 'cr720_wfrdpn', 'cr720_id', 'cr720_description',
      'cr720_classification', 'cr720_leadtimeday', 'cr720_unitpriceusd', 'cr720_plname',
      'cr720_customer', 'cr720_country', 'cr720_contractnumber'],
    filter: "statecode eq 0 and cr720_plname eq 'Managed Pressure Drilling'",
    orderBy: ['cr720_description asc'], top: 500,
  });
  if (!result.success) throw new Error(result.error?.message || 'Dataverse did not return the MPD price list.');
  return (result.data || []).map(mapItem);
}
