/**
 * CSV utility functions using PapaParse library
 */
import Papa from 'papaparse'

export function objectsToCSV(params: { objects: any[]; headers?: string[] }) {
  const { objects, headers } = params

  if (!Array.isArray(objects) || objects.length === 0) {
    throw new Error('CSV conversion requires a non-empty array of objects')
  }

  // Use PapaParse to convert objects to CSV
  const csv = Papa.unparse(objects, {
    header: true,
    columns: headers, // If headers provided, use only those columns
  })

  return csv
}

export function csvToObjects(params: { csvContent: string; hasHeaders?: boolean }) {
  const { csvContent, hasHeaders = true } = params

  // Use PapaParse to parse CSV content
  const result = Papa.parse(csvContent, {
    header: hasHeaders,
    skipEmptyLines: true,
    dynamicTyping: true, // Automatically convert numbers and booleans
  })

  if (result.errors.length > 0) {
    console.warn('CSV parsing warnings:', result.errors)
  }

  return result.data
}
