import { subYears } from 'date-fns';
import { testCases } from './testCases';
import { parseRequest, isCheckRequest } from '../parser/inputParser';
import { lookupApproval } from '../lookup/register';
import type { ApprovalRecord, RegisterMap } from '../loader/types';

/** Builds a minimal mock register for lookup integration tests. */
function buildMockRegister(): RegisterMap {
  const expired: ApprovalRecord = {
    saNo: 'SA-0001',
    aa: 'AA-001',
    amendment: '1',
    submitter: 'Test Submitter A',
    dateOfApproval: subYears(new Date(), 5),
    expiryDate: subYears(new Date(), 1),
    type: 'Platform Scale',
    maxMin: '0-60kg',
    scaleInterval: 'e=10g',
    class: 'III',
    lmid: 'LM001',
    softwareVersion: '1.0',
    loadReceptor: '',
    loadCells: '',
    junctionBox: '',
    siteSpecific: '',
    rawAmendmentRows: [],
  };

  const valid: ApprovalRecord = {
    saNo: 'SA-0002',
    aa: 'AA-002',
    amendment: '1',
    submitter: 'Test Submitter B',
    dateOfApproval: subYears(new Date(), 2),
    expiryDate: null,
    type: 'Bench Scale',
    maxMin: '0-30kg',
    scaleInterval: 'e=5g',
    class: 'III',
    lmid: 'LM002',
    softwareVersion: '2.1',
    loadReceptor: '',
    loadCells: '',
    junctionBox: '',
    siteSpecific: '',
    rawAmendmentRows: [],
  };

  return new Map([
    ['SA-0001', expired],
    ['SA-0002', valid],
  ]);
}

let passed = 0;
let failed = 0;

function fail(description: string, detail: string): void {
  failed++;
  console.log(`  FAIL — ${description}`);
  console.log(`         ${detail}`);
}

function pass(description: string): void {
  passed++;
  console.log(`  PASS — ${description}`);
}

console.log('\nWeighSoft Bot — Test Runner\n');

const mockRegister = buildMockRegister();

for (const tc of testCases) {
  const parsed = parseRequest(tc.input);
  const isCheck = isCheckRequest(tc.input);

  if (tc.expectedStatus === 'IGNORED' && tc.expectedSaNo === null) {
    if (parsed !== null) {
      fail(tc.description, `Expected null parse, got saNo="${parsed.saNo}"`);
      continue;
    }
    if (isCheck) {
      fail(tc.description, 'Expected isCheckRequest=false, got true');
      continue;
    }
    pass(tc.description);
    continue;
  }

  if (tc.expectedSaNo !== null) {
    if (!parsed) {
      fail(tc.description, `Expected saNo="${tc.expectedSaNo}", got null`);
      continue;
    }
    if (parsed.saNo !== tc.expectedSaNo) {
      fail(tc.description, `Expected saNo="${tc.expectedSaNo}", got "${parsed.saNo}"`);
      continue;
    }
  }

  if (tc.expectedStatus !== 'IGNORED') {
    if (!parsed) {
      fail(tc.description, 'Parse returned null but lookup status expected');
      continue;
    }
    const result = lookupApproval(mockRegister, parsed);
    if (result.status !== tc.expectedStatus) {
      fail(tc.description, `Expected status="${tc.expectedStatus}", got "${result.status}"`);
      continue;
    }
  }

  pass(tc.description);
}

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${testCases.length}\n`);
process.exit(failed > 0 ? 1 : 0);
