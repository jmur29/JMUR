import { APIRequestContext } from '@playwright/test';

// Direct API helpers for seeding test data
export async function createTestApplication(request: APIRequestContext, token: string) {
  const response = await request.post('/api/applications', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      borrower: {
        firstName: 'Test',
        lastName: 'Borrower',
        dob: '1985-06-15',
        email: 'test@example.com',
        phone: '416-555-0100',
        sin: '123456789',
        employmentType: 'EMPLOYED',
        creditScore: 720,
        bankruptcies: false,
        collections: false,
        existingMortgages: 0,
      },
    },
  });
  return response.json();
}
