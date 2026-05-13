import { Request, Response, NextFunction } from 'express';
import { z, ZodTypeAny } from 'zod';

// ─── Middleware factory ───────────────────────────────────────────────────────

type RequestPart = 'body' | 'query' | 'params';

export function validate(schema: ZodTypeAny, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      next(result.error);
      return;
    }
    // Replace the request part with the parsed (coerced) data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any)[part] = result.data;
    next();
  };
}

// ─── Shared primitives ────────────────────────────────────────────────────────

const positiveDecimal = z.number().nonnegative();
const uuid = z.string().uuid();

// ─── Application schemas ──────────────────────────────────────────────────────

export const CreateApplicationSchema = z.object({
  // fileNumber is generated server-side; no fields required at creation
});

export const UpdateApplicationSchema = z.object({
  status: z
    .enum(['DRAFT', 'IN_REVIEW', 'APPROVED', 'DECLINED', 'CONDITIONALLY_APPROVED'])
    .optional(),
  assignedToId: z.string().uuid().nullable().optional(),
});

export const ListApplicationsQuerySchema = z.object({
  status: z
    .enum(['DRAFT', 'IN_REVIEW', 'APPROVED', 'DECLINED', 'CONDITIONALLY_APPROVED'])
    .optional(),
  assignedToId: uuid.optional(),
  cursor: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Borrower schemas ─────────────────────────────────────────────────────────

export const CreateBorrowerSchema = z.object({
  applicationId: uuid,
  type: z.enum(['PRIMARY', 'CO_BORROWER']),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dob: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  email: z.string().email(),
  phone: z.string().min(7).max(20),
  sin: z.string().regex(/^\d{9}$/, 'SIN must be exactly 9 digits'),
  employmentType: z.enum(['EMPLOYED', 'SELF_EMPLOYED', 'CONTRACT', 'RETIRED', 'OTHER']),
  creditScore: z.number().int().min(300).max(900),
  bankruptcies: z.boolean().default(false),
  collections: z.boolean().default(false),
  existingMortgages: z.number().int().min(0).default(0),
});

export const UpdateBorrowerSchema = CreateBorrowerSchema.omit({
  applicationId: true,
  sin: true,
  type: true,
}).partial().extend({
  sin: z.string().regex(/^\d{9}$/).optional(),
});

// ─── Income schemas ───────────────────────────────────────────────────────────

export const UpsertIncomeSchema = z.object({
  employerName: z.string().max(200).nullable().optional(),
  jobTitle: z.string().max(200).nullable().optional(),
  yearsEmployed: z.number().nonnegative().nullable().optional(),
  baseSalary: positiveDecimal.default(0),
  bonus: positiveDecimal.default(0),
  overtime: positiveDecimal.default(0),
  otherIncome: positiveDecimal.default(0),
  selfEmployedAvg: positiveDecimal.nullable().optional(),
  rentalIncome: positiveDecimal.default(0),
});

// ─── Property schemas ─────────────────────────────────────────────────────────

export const UpsertPropertySchema = z.object({
  address: z.string().min(1).max(300),
  city: z.string().min(1).max(100),
  province: z.string().length(2),
  postalCode: z
    .string()
    .regex(/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, 'Invalid Canadian postal code'),
  propertyType: z.enum(['DETACHED', 'SEMI', 'TOWNHOUSE', 'CONDO', 'DUPLEX', 'OTHER']),
  occupancy: z.enum(['OWNER', 'RENTAL', 'SECONDARY']),
  purchasePrice: z.number().positive(),
  appraisedValue: z.number().positive(),
  downPayment: z.number().positive(),
  annualTax: z.number().nonnegative(),
  monthlyHeat: z.number().nonnegative(),
  condoFees: z.number().nonnegative().default(0),
});

// ─── Mortgage terms schemas ───────────────────────────────────────────────────

export const UpsertTermsSchema = z.object({
  contractRate: z.number().positive().max(30),
  amortizationYears: z.number().int().min(5).max(30),
  termYears: z.number().int().min(1).max(10),
  insured: z.boolean().default(false),
});

// ─── Underwriting decision schema ─────────────────────────────────────────────

export const SaveDecisionSchema = z.object({
  notes: z.string().max(5000).optional(),
});

// ─── Document schemas ─────────────────────────────────────────────────────────

export const UpdateDocumentSchema = z.object({
  status: z.enum(['PENDING', 'REVIEWED', 'APPROVED', 'REJECTED']),
});

// ─── Admin schemas ────────────────────────────────────────────────────────────

export const UpdateUserRoleSchema = z.object({
  role: z.enum(['ADMIN', 'UNDERWRITER', 'VIEWER']),
});

// ─── Param schemas ────────────────────────────────────────────────────────────

export const UuidParamSchema = z.object({
  id: uuid,
});

export const ApplicationIdParamSchema = z.object({
  applicationId: uuid,
});

export const BorrowerIdParamSchema = z.object({
  borrowerId: uuid,
});
