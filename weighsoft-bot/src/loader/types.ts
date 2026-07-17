/** Shared TypeScript types for the WeighSoft register loader. */

export interface RawRow {
  SA_No: string;
  AA: string;
  Amndm: string;
  Submitter: string;
  DateOfApproval: string;
  ExpiryDate: string;
  Type: string;
  MaxMin: string;
  ScaleInterval: string;
  Class: string;
  LMID: string;
  SoftwareVersion: string;
  LoadReceptor: string;
  LoadCells: string;
  JunctionBox: string;
  SiteSpecific: string;
}

export interface ApprovalRecord {
  saNo: string;
  aa: string;
  amendment: string;
  submitter: string;
  dateOfApproval: Date | null;
  expiryDate: Date | null;
  type: string;
  maxMin: string;
  scaleInterval: string;
  class: string;
  lmid: string;
  softwareVersion: string;
  loadReceptor: string;
  loadCells: string;
  junctionBox: string;
  siteSpecific: string;
  rawAmendmentRows: RawRow[];
}

export type RegisterMap = Map<string, ApprovalRecord>;
