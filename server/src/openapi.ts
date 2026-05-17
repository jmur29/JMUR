/**
 * ClearPath UW — OpenAPI 3.1 specification.
 * Served as JSON at GET /api/docs and as Swagger UI at GET /api/docs/ui
 */

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'ClearPath UW API',
    version: '1.0.0',
    description:
      'Multi-tenant mortgage underwriting API. All routes (except /health and /api/docs) require a Clerk JWT bearer token.',
    contact: { name: 'ClearPath UW', url: 'https://github.com/clearpath-uw' },
  },
  servers: [
    { url: 'http://localhost:3001', description: 'Local development server' },
  ],
  security: [{ BearerAuth: [] }],
  tags: [
    { name: 'Applications', description: 'Application lifecycle management' },
    { name: 'Borrowers', description: 'Borrower records (primary + co-borrower)' },
    { name: 'Income', description: 'Borrower income details' },
    { name: 'Property', description: 'Subject property details' },
    { name: 'Terms', description: 'Mortgage terms (rate, amortization, etc.)' },
    { name: 'Underwriting', description: 'Automated underwriting engine' },
    { name: 'Documents', description: 'Document upload and management' },
    { name: 'Reports', description: 'PDF / HTML report generation' },
    { name: 'Admin', description: 'User management and pipeline statistics' },
    { name: 'Webhooks', description: 'Inbound Clerk webhooks (signature verified)' },
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        operationId: 'healthCheck',
        security: [],
        tags: ['Admin'],
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    ts: { type: 'string', format: 'date-time' },
                    db: { type: 'string', example: 'ok' },
                    version: { type: 'string', example: '1.0.0' },
                    env: { type: 'string', example: 'production' },
                  },
                },
              },
            },
          },
          '503': {
            description: 'Database unreachable',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },

    // ── Applications ──────────────────────────────────────────────────────────

    '/api/applications': {
      get: {
        summary: 'List applications',
        operationId: 'listApplications',
        tags: ['Applications'],
        parameters: [
          { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/ApplicationStatus' } },
          { name: 'assignedToId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          '200': {
            description: 'Paginated application list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    items: { type: 'array', items: { $ref: '#/components/schemas/Application' } },
                    nextCursor: { type: 'string', nullable: true },
                    hasNextPage: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create application',
        operationId: 'createApplication',
        tags: ['Applications'],
        responses: {
          '201': {
            description: 'Application created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Application' },
              },
            },
          },
        },
      },
    },

    '/api/applications/search': {
      get: {
        summary: 'Search applications',
        operationId: 'searchApplications',
        tags: ['Applications'],
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 1 } },
        ],
        responses: {
          '200': {
            description: 'Search results (top 10)',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/SearchResult' },
                },
              },
            },
          },
        },
      },
    },

    '/api/applications/{id}': {
      get: {
        summary: 'Get application by ID',
        operationId: 'getApplicationById',
        tags: ['Applications'],
        parameters: [{ $ref: '#/components/parameters/IdParam' }],
        responses: {
          '200': {
            description: 'Application found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Application' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      patch: {
        summary: 'Update application status or assignment',
        operationId: 'updateApplication',
        tags: ['Applications'],
        parameters: [{ $ref: '#/components/parameters/IdParam' }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { $ref: '#/components/schemas/ApplicationStatus' },
                  assignedToId: { type: 'string', format: 'uuid', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated application',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Application' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        summary: 'Soft delete application',
        operationId: 'deleteApplication',
        tags: ['Applications'],
        parameters: [{ $ref: '#/components/parameters/IdParam' }],
        responses: {
          '204': { description: 'Deleted' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    '/api/applications/{id}/duplicate': {
      post: {
        summary: 'Duplicate an application',
        operationId: 'duplicateApplication',
        tags: ['Applications'],
        parameters: [{ $ref: '#/components/parameters/IdParam' }],
        responses: {
          '201': {
            description: 'Duplicated application',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Application' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    '/api/applications/{id}/history': {
      get: {
        summary: 'Get status history',
        operationId: 'getStatusHistory',
        tags: ['Applications'],
        parameters: [{ $ref: '#/components/parameters/IdParam' }],
        responses: {
          '200': {
            description: 'Status history entries',
            content: {
              'application/json': {
                schema: { type: 'array', items: { type: 'object' } },
              },
            },
          },
        },
      },
    },

    // ── Borrowers ─────────────────────────────────────────────────────────────

    '/api/borrowers': {
      post: {
        summary: 'Create borrower',
        operationId: 'createBorrower',
        tags: ['Borrowers'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BorrowerInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Borrower created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Borrower' },
              },
            },
          },
        },
      },
    },

    '/api/borrowers/{id}': {
      get: {
        summary: 'Get borrower',
        operationId: 'getBorrower',
        tags: ['Borrowers'],
        parameters: [{ $ref: '#/components/parameters/IdParam' }],
        responses: {
          '200': {
            description: 'Borrower',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Borrower' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      patch: {
        summary: 'Update borrower',
        operationId: 'updateBorrower',
        tags: ['Borrowers'],
        parameters: [{ $ref: '#/components/parameters/IdParam' }],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BorrowerInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated borrower',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Borrower' },
              },
            },
          },
        },
      },
    },

    // ── Income ────────────────────────────────────────────────────────────────

    '/api/income/{borrowerId}': {
      put: {
        summary: 'Upsert income for a borrower',
        operationId: 'upsertIncome',
        tags: ['Income'],
        parameters: [
          { name: 'borrowerId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/IncomeInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Upserted income',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Income' },
              },
            },
          },
        },
      },
    },

    // ── Property ──────────────────────────────────────────────────────────────

    '/api/property/{applicationId}': {
      put: {
        summary: 'Upsert property for an application',
        operationId: 'upsertProperty',
        tags: ['Property'],
        parameters: [
          { name: 'applicationId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PropertyInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Upserted property',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Property' },
              },
            },
          },
        },
      },
    },

    // ── Terms ─────────────────────────────────────────────────────────────────

    '/api/terms/{applicationId}': {
      put: {
        summary: 'Upsert mortgage terms for an application',
        operationId: 'upsertTerms',
        tags: ['Terms'],
        parameters: [
          { name: 'applicationId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/MortgageTermsInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Upserted mortgage terms',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MortgageTerms' },
              },
            },
          },
        },
      },
    },

    // ── Underwriting ──────────────────────────────────────────────────────────

    '/api/underwriting/{applicationId}/calculate': {
      get: {
        summary: 'Calculate underwriting (dry run, not saved)',
        operationId: 'calculateUnderwriting',
        tags: ['Underwriting'],
        parameters: [
          { name: 'applicationId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'UW result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UWResult' },
              },
            },
          },
        },
      },
    },

    '/api/underwriting/{applicationId}/decide': {
      post: {
        summary: 'Run underwriting and save decision',
        operationId: 'saveDecision',
        tags: ['Underwriting'],
        parameters: [
          { name: 'applicationId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { notes: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Decision saved',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UnderwritingDecision' },
              },
            },
          },
        },
      },
    },

    // ── Documents ─────────────────────────────────────────────────────────────

    '/api/documents': {
      post: {
        summary: 'Upload a document',
        operationId: 'uploadDocument',
        tags: ['Documents'],
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { type: 'object' } } },
        },
        responses: {
          '201': {
            description: 'Document uploaded',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Document' },
              },
            },
          },
        },
      },
    },

    '/api/documents/{id}': {
      delete: {
        summary: 'Delete document',
        operationId: 'deleteDocument',
        tags: ['Documents'],
        parameters: [{ $ref: '#/components/parameters/IdParam' }],
        responses: {
          '204': { description: 'Deleted' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ── Reports ───────────────────────────────────────────────────────────────

    '/api/reports/{applicationId}': {
      get: {
        summary: 'Generate PDF underwriting report',
        operationId: 'generateReport',
        tags: ['Reports'],
        parameters: [
          { name: 'applicationId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'PDF report',
            content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
          },
        },
      },
    },

    // ── Admin ─────────────────────────────────────────────────────────────────

    '/api/admin/stats': {
      get: {
        summary: 'Get pipeline statistics',
        operationId: 'getPipelineStats',
        tags: ['Admin'],
        responses: {
          '200': {
            description: 'Pipeline statistics',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PipelineStats' },
              },
            },
          },
        },
      },
    },

    '/api/admin/users': {
      get: {
        summary: 'List users in tenant',
        operationId: 'listUsers',
        tags: ['Admin'],
        responses: {
          '200': {
            description: 'User list',
            content: {
              'application/json': {
                schema: { type: 'array', items: { type: 'object' } },
              },
            },
          },
        },
      },
    },
  },

  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Clerk-issued JWT. Include as Authorization: Bearer <token>',
      },
    },
    parameters: {
      IdParam: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    },
    responses: {
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
        },
      },
      ApplicationStatus: {
        type: 'string',
        enum: [
          'DRAFT',
          'IN_REVIEW',
          'APPROVED',
          'DECLINED',
          'CONDITIONALLY_APPROVED',
          'WITHDRAWN',
        ],
      },
      Application: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', format: 'uuid' },
          fileNumber: { type: 'string', example: 'CLR-2024-00042' },
          status: { $ref: '#/components/schemas/ApplicationStatus' },
          assignedToId: { type: 'string', format: 'uuid', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          deletedAt: { type: 'string', format: 'date-time', nullable: true },
          borrowers: { type: 'array', items: { $ref: '#/components/schemas/Borrower' } },
          property: { $ref: '#/components/schemas/Property', nullable: true },
          mortgageTerms: { $ref: '#/components/schemas/MortgageTerms', nullable: true },
          decisions: { type: 'array', items: { $ref: '#/components/schemas/UnderwritingDecision' } },
          documents: { type: 'array', items: { $ref: '#/components/schemas/Document' } },
        },
      },
      SearchResult: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          fileNumber: { type: 'string' },
          status: { $ref: '#/components/schemas/ApplicationStatus' },
          borrowerName: { type: 'string' },
          borrowerEmail: { type: 'string', format: 'email' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Borrower: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          applicationId: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: ['PRIMARY', 'CO_BORROWER'] },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          dob: { type: 'string', format: 'date-time' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          employmentType: {
            type: 'string',
            enum: ['EMPLOYED', 'SELF_EMPLOYED', 'CONTRACT', 'RETIRED', 'OTHER'],
          },
          creditScore: { type: 'integer', minimum: 300, maximum: 900 },
          bankruptcies: { type: 'boolean' },
          collections: { type: 'boolean' },
          existingMortgages: { type: 'integer', minimum: 0 },
          income: { $ref: '#/components/schemas/Income', nullable: true },
        },
      },
      BorrowerInput: {
        type: 'object',
        required: ['applicationId', 'type', 'firstName', 'lastName', 'dob', 'email', 'phone', 'sin', 'employmentType', 'creditScore'],
        properties: {
          applicationId: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: ['PRIMARY', 'CO_BORROWER'] },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          dob: { type: 'string', format: 'date' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          sin: { type: 'string', description: 'Social Insurance Number (stored encrypted)' },
          employmentType: {
            type: 'string',
            enum: ['EMPLOYED', 'SELF_EMPLOYED', 'CONTRACT', 'RETIRED', 'OTHER'],
          },
          creditScore: { type: 'integer', minimum: 300, maximum: 900 },
          bankruptcies: { type: 'boolean', default: false },
          collections: { type: 'boolean', default: false },
          existingMortgages: { type: 'integer', minimum: 0, default: 0 },
        },
      },
      Income: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          borrowerId: { type: 'string', format: 'uuid' },
          employerName: { type: 'string', nullable: true },
          jobTitle: { type: 'string', nullable: true },
          yearsEmployed: { type: 'number', nullable: true },
          baseSalary: { type: 'number' },
          bonus: { type: 'number' },
          overtime: { type: 'number' },
          otherIncome: { type: 'number' },
          selfEmployedAvg: { type: 'number', nullable: true },
          rentalIncome: { type: 'number' },
        },
      },
      IncomeInput: {
        type: 'object',
        properties: {
          employerName: { type: 'string' },
          jobTitle: { type: 'string' },
          yearsEmployed: { type: 'number' },
          baseSalary: { type: 'number', default: 0 },
          bonus: { type: 'number', default: 0 },
          overtime: { type: 'number', default: 0 },
          otherIncome: { type: 'number', default: 0 },
          selfEmployedAvg: { type: 'number', nullable: true },
          rentalIncome: { type: 'number', default: 0 },
        },
      },
      Property: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          applicationId: { type: 'string', format: 'uuid' },
          address: { type: 'string' },
          city: { type: 'string' },
          province: { type: 'string' },
          postalCode: { type: 'string' },
          propertyType: { type: 'string' },
          occupancy: { type: 'string' },
          purchasePrice: { type: 'number' },
          appraisedValue: { type: 'number' },
          downPayment: { type: 'number' },
          annualTax: { type: 'number' },
          monthlyHeat: { type: 'number' },
          condoFees: { type: 'number', default: 0 },
        },
      },
      PropertyInput: {
        type: 'object',
        required: ['address', 'city', 'province', 'postalCode', 'propertyType', 'occupancy', 'purchasePrice', 'appraisedValue', 'downPayment', 'annualTax', 'monthlyHeat'],
        properties: {
          address: { type: 'string' },
          city: { type: 'string' },
          province: { type: 'string' },
          postalCode: { type: 'string' },
          propertyType: { type: 'string' },
          occupancy: { type: 'string' },
          purchasePrice: { type: 'number' },
          appraisedValue: { type: 'number' },
          downPayment: { type: 'number' },
          annualTax: { type: 'number' },
          monthlyHeat: { type: 'number' },
          condoFees: { type: 'number', default: 0 },
        },
      },
      MortgageTerms: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          applicationId: { type: 'string', format: 'uuid' },
          contractRate: { type: 'number', description: 'Annual contract rate (%)' },
          stressRate: { type: 'number', description: 'Qualifying stress rate (%)' },
          amortizationYears: { type: 'integer' },
          termYears: { type: 'integer' },
          insured: { type: 'boolean' },
          monthlyPayment: { type: 'number' },
          mortgageAmount: { type: 'number' },
        },
      },
      MortgageTermsInput: {
        type: 'object',
        required: ['contractRate', 'amortizationYears', 'termYears'],
        properties: {
          contractRate: { type: 'number' },
          amortizationYears: { type: 'integer' },
          termYears: { type: 'integer' },
          insured: { type: 'boolean', default: false },
        },
      },
      UWResult: {
        type: 'object',
        properties: {
          monthlyIncome: { type: 'number' },
          mortgageAmount: { type: 'number' },
          monthlyPayment: { type: 'number' },
          stressPayment: { type: 'number' },
          gds: { type: 'number', description: 'Gross Debt Service ratio (%)' },
          tds: { type: 'number', description: 'Total Debt Service ratio (%)' },
          ltv: { type: 'number', description: 'Loan-to-Value ratio (%)' },
          stressGds: { type: 'number' },
          stressTds: { type: 'number' },
          stressRate: { type: 'number' },
          cmhcPremium: { type: 'number', description: 'CMHC insurance premium amount ($)' },
          cmhcPremiumRate: { type: 'number', description: 'CMHC premium rate (%)' },
          effectiveMortgage: { type: 'number', description: 'Mortgage + CMHC premium' },
          effectiveMonthlyPayment: { type: 'number' },
          decision: { type: 'string', enum: ['APPROVE', 'MANUAL_REVIEW', 'DECLINE'] },
          flags: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['PASS', 'WARN', 'FAIL', 'INFO'] },
                message: { type: 'string' },
                field: { type: 'string' },
              },
            },
          },
          qualifyingIncome: {
            type: 'object',
            properties: {
              baseSalary: { type: 'number' },
              bonus: { type: 'number' },
              overtime: { type: 'number' },
              otherIncome: { type: 'number' },
              selfEmployed: { type: 'number' },
              rental: { type: 'number' },
              coApplicant: { type: 'number' },
              total: { type: 'number' },
            },
          },
        },
      },
      UnderwritingDecision: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          applicationId: { type: 'string', format: 'uuid' },
          gds: { type: 'number' },
          tds: { type: 'number' },
          ltv: { type: 'number' },
          stressGds: { type: 'number' },
          stressTds: { type: 'number' },
          decision: { type: 'string', enum: ['APPROVE', 'MANUAL_REVIEW', 'DECLINE'] },
          flags: { type: 'array', items: { type: 'object' } },
          notes: { type: 'string', nullable: true },
          decidedAt: { type: 'string', format: 'date-time' },
          decidedBy: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
            },
          },
        },
      },
      Document: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          applicationId: { type: 'string', format: 'uuid' },
          fileName: { type: 'string' },
          fileType: { type: 'string' },
          fileSize: { type: 'integer' },
          s3Key: { type: 'string' },
          uploadedAt: { type: 'string', format: 'date-time' },
          uploadedBy: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
            },
          },
        },
      },
      PipelineStats: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          byStatus: { type: 'object', additionalProperties: { type: 'integer' } },
          monthlyTrend: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                month: { type: 'string', example: '2024-05' },
                total: { type: 'integer' },
                approved: { type: 'integer' },
                declined: { type: 'integer' },
                inReview: { type: 'integer' },
              },
            },
          },
        },
      },
    },
  },
} as const;
