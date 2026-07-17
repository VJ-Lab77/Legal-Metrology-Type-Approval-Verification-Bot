export interface TestCase {
  input: string;
  expectedSaNo: string | null;
  expectedStatus: 'APPROVED' | 'DENIED_EXPIRED' | 'DENIED_NOT_FOUND' | 'IGNORED';
  description: string;
}

export const testCases: TestCase[] = [
  {
    input: 'check SA-1234/05',
    expectedSaNo: 'SA-1234/05',
    expectedStatus: 'IGNORED',
    description: 'Basic check with SA number and slash suffix',
  },
  {
    input: 'SA 4521',
    expectedSaNo: 'SA4521',
    expectedStatus: 'IGNORED',
    description: 'SA number with space, no prefix',
  },
  {
    input: 'Please verify SA-0089/12 class III max 60kg',
    expectedSaNo: 'SA-0089/12',
    expectedStatus: 'IGNORED',
    description: 'SA number with class and max specs',
  },
  {
    input: 'Check SA1234 software version 2.3.1',
    expectedSaNo: 'SA1234',
    expectedStatus: 'IGNORED',
    description: 'SA number with software version',
  },
  {
    input: 'SA-9999/99',
    expectedSaNo: 'SA-9999/99',
    expectedStatus: 'DENIED_NOT_FOUND',
    description: 'Made-up SA number not in register',
  },
  {
    input: '🔍 check SA-2201/18 please',
    expectedSaNo: 'SA-2201/18',
    expectedStatus: 'IGNORED',
    description: 'Message with emoji prefix',
  },
  {
    input: 'Hi team,\nCan someone check this?\nSA-3344/22\nThanks',
    expectedSaNo: 'SA-3344/22',
    expectedStatus: 'IGNORED',
    description: 'Multi-line message with buried SA number',
  },
  {
    input: 'Good morning everyone',
    expectedSaNo: null,
    expectedStatus: 'IGNORED',
    description: 'Unrelated chatter — no SA number',
  },
  {
    input: 'The weather is nice today SA road is busy',
    expectedSaNo: null,
    expectedStatus: 'IGNORED',
    description: 'SA not followed by digits — should be ignored',
  },
  {
    input: 'SA-0001',
    expectedSaNo: 'SA-0001',
    expectedStatus: 'DENIED_EXPIRED',
    description: 'Expired approval in mock register',
  },
  {
    input: 'SA-0002',
    expectedSaNo: 'SA-0002',
    expectedStatus: 'APPROVED',
    description: 'Valid approval with no expiry date',
  },
  {
    input: 'verify sa-1111/03',
    expectedSaNo: 'SA-1111/03',
    expectedStatus: 'IGNORED',
    description: 'Lowercase SA number normalised to uppercase',
  },
  {
    input: '#SA-5555',
    expectedSaNo: 'SA-5555',
    expectedStatus: 'IGNORED',
    description: 'Hash prefix before SA number',
  },
  {
    input: 'check SA 3333 / 07',
    expectedSaNo: 'SA-3333/07',
    expectedStatus: 'IGNORED',
    description: 'Spaces around slash in SA number',
  },
  {
    input: 'My number is +27821234567, please call me',
    expectedSaNo: null,
    expectedStatus: 'IGNORED',
    description: 'SA phone number without approval number',
  },
];
