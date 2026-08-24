import type { Cr720_wfrdmanufactureaddresseses } from '../generated/models/Cr720_wfrdmanufactureaddressesesModel';
import { Cr720_wfrdmanufactureaddressesesService } from '../generated/services/Cr720_wfrdmanufactureaddressesesService';

export interface ManufactureAddress {
  id: string;
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  countryRegion: string;
  coordinates: string;
  location: [number, number];
  choice: string;
}

function parseCoordinates(value?: string): [number, number] | null {
  const matches = value?.match(/-?\d+(?:[.,]\d+)?/g);
  if (!matches || matches.length < 2) return null;

  // Dataverse stores this field as "longitude, latitude"; Cobe expects [latitude, longitude].
  const longitude = Number(matches[0].replace(',', '.'));
  const latitude = Number(matches[1].replace(',', '.'));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return [latitude, longitude];
}

function mapAddress(record: Cr720_wfrdmanufactureaddresseses): ManufactureAddress | null {
  const location = parseCoordinates(record.cr720_locationcoordenadas);
  if (!location) return null;

  return {
    id: record.cr720_wfrdmanufactureaddressesid,
    name: record.cr720_locationnome?.trim() || record.cr720_name?.trim() || 'Weatherford location',
    street: record.cr720_locationrua?.trim() || '',
    city: record.cr720_locationcidade?.trim() || '',
    state: record.cr720_locationestado?.trim() || '',
    zip: record.cr720_locationcep?.trim() || '',
    countryRegion: record.cr720_locationpasregio?.trim() || '',
    coordinates: record.cr720_locationcoordenadas?.trim() || `${location[0]}, ${location[1]}`,
    location,
    choice: record.cr720_choice?.trim() || record.cr720_locationpasregio?.trim() || 'Pickup location',
  };
}

let addressRequest: Promise<ManufactureAddress[]> | null = null;

export function getManufactureAddresses() {
  if (addressRequest) return addressRequest;

  addressRequest = Cr720_wfrdmanufactureaddressesesService.getAll({
    select: [
      'cr720_wfrdmanufactureaddressesid',
      'cr720_name',
      'cr720_choice',
      'cr720_locationcep',
      'cr720_locationcidade',
      'cr720_locationcoordenadas',
      'cr720_locationestado',
      'cr720_locationnome',
      'cr720_locationpasregio',
      'cr720_locationrua',
    ],
    filter: 'statecode eq 0',
    orderBy: ['cr720_locationpasregio asc', 'cr720_locationnome asc'],
    top: 250,
  }).then((result) => {
    if (!result.success) throw new Error(result.error?.message || 'Dataverse did not return the pickup locations.');
    return (result.data || []).map(mapAddress).filter((address): address is ManufactureAddress => Boolean(address));
  }).catch((error) => {
    addressRequest = null;
    throw error;
  });

  return addressRequest;
}
