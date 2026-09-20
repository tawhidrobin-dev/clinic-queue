import * as XLSX from 'xlsx';

export interface ParsedAppointmentRow {
  serialNumber: number;
  fullName: string;
  phoneNumber: string;
  age?: number | null;
  gender?: string | null;
  appointmentType: 'NEW_PATIENT' | 'REPORT_CHECK' | 'FOLLOW_UP' | 'EMERGENCY';
  preferredTransport?: string;
  estimatedTravelMins?: number | null;
  homeLatitude?: string | null;
  homeLongitude?: string | null;
}

/**
 * Standardize Bangladesh phone numbers into +8801XXXXXXXXX format
 */
export function normalizePhoneNumber(raw: any): string {
  if (!raw) return '';
  let str = String(raw).trim().replace(/[^0-9+]/g, '');

  if (str.startsWith('+880')) {
    return str;
  }
  if (str.startsWith('880')) {
    return `+${str}`;
  }
  if (str.startsWith('01')) {
    return `+88${str}`;
  }
  if (str.startsWith('1') && str.length === 10) {
    return `+880${str}`;
  }
  return str.startsWith('+') ? str : `+${str}`;
}

/**
 * Normalize appointment type string
 */
export function normalizeAppointmentType(
  raw: any,
): 'NEW_PATIENT' | 'REPORT_CHECK' | 'FOLLOW_UP' | 'EMERGENCY' {
  if (!raw) return 'NEW_PATIENT';
  const val = String(raw).trim().toUpperCase().replace(/[\s-_]+/g, '_');

  if (val.includes('REPORT')) return 'REPORT_CHECK';
  if (val.includes('FOLLOW')) return 'FOLLOW_UP';
  if (val.includes('EMERGENCY')) return 'EMERGENCY';
  return 'NEW_PATIENT';
}

/**
 * Parse an Excel/CSV buffer into an array of validated appointment rows
 */
export function parseAppointmentSpreadsheet(fileBuffer: Buffer): ParsedAppointmentRow[] {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error('Spreadsheet has no sheets');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  if (rawRows.length === 0) {
    throw new Error('Uploaded sheet is empty');
  }

  const results: ParsedAppointmentRow[] = [];

  rawRows.forEach((row, index) => {
    // Flexible column lookup
    const getCol = (...keys: string[]) => {
      for (const k of keys) {
        const matchingKey = Object.keys(row).find(
          (rk) => rk.toLowerCase().trim() === k.toLowerCase().trim(),
        );
        if (matchingKey && row[matchingKey] !== undefined && row[matchingKey] !== '') {
          return row[matchingKey];
        }
      }
      return undefined;
    };

    const rawSerial = getCol('serial', 'serial number', 'sl', 'sl no', 'token', 'serial_number');
    const serialNumber = rawSerial ? parseInt(String(rawSerial), 10) : index + 1;

    const fullName = String(
      getCol('patient name', 'name', 'full name', 'patient', 'full_name') || `Patient #${serialNumber}`,
    ).trim();

    const rawPhone = getCol('phone', 'phone number', 'mobile', 'contact', 'mobile number', 'phone_number');
    const phoneNumber = normalizePhoneNumber(rawPhone);

    const rawAge = getCol('age', 'patient age');
    const age = rawAge ? parseInt(String(rawAge), 10) : null;

    const rawGender = getCol('gender', 'sex');
    const gender = rawGender ? String(rawGender).trim() : null;

    const rawType = getCol('appointment type', 'type', 'visit type', 'appointment_type');
    const appointmentType = normalizeAppointmentType(rawType);

    const rawTransport = getCol('preferred transport', 'transport', 'transport mode');
    const preferredTransport = rawTransport ? String(rawTransport).trim().toUpperCase() : 'CAR';

    const rawTravel = getCol('travel mins', 'estimated travel', 'travel time', 'estimated_travel_mins');
    const estimatedTravelMins = rawTravel ? parseInt(String(rawTravel), 10) : 25;

    const rawLat = getCol('latitude', 'lat', 'home latitude');
    const rawLng = getCol('longitude', 'lng', 'home longitude');

    results.push({
      serialNumber: isNaN(serialNumber) ? index + 1 : serialNumber,
      fullName,
      phoneNumber: phoneNumber || `+880170000000${index + 1}`,
      age: isNaN(age as number) ? null : age,
      gender,
      appointmentType,
      preferredTransport,
      estimatedTravelMins: isNaN(estimatedTravelMins as number) ? 25 : estimatedTravelMins,
      homeLatitude: rawLat ? String(rawLat) : null,
      homeLongitude: rawLng ? String(rawLng) : null,
    });
  });

  // Sort ascending by serial number
  return results.sort((a, b) => a.serialNumber - b.serialNumber);
}

/**
 * Generates sample CSV template data
 */
export function generateSampleCsv(): string {
  const headers = [
    'Serial Number',
    'Patient Name',
    'Phone Number',
    'Age',
    'Gender',
    'Appointment Type',
    'Preferred Transport',
    'Estimated Travel Mins',
  ];

  const rows = [
    ['1', 'Tanvir Ahmed', '+8801711111111', '35', 'Male', 'NEW_PATIENT', 'CAR', '30'],
    ['2', 'Nusrat Jahan', '+8801722222222', '28', 'Female', 'REPORT_CHECK', 'CNG', '20'],
    ['3', 'Abdul Karim', '+8801733333333', '55', 'Male', 'FOLLOW_UP', 'CAR', '40'],
    ['4', 'Farzana Yasmin', '+8801744444444', '42', 'Female', 'NEW_PATIENT', 'BIKE', '15'],
    ['5', 'Kamal Hossain', '+8801755555555', '60', 'Male', 'EMERGENCY', 'CAR', '25'],
  ];

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
