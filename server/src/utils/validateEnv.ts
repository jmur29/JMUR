// Validates required env vars at startup and throws descriptive errors if missing.

interface EnvSpec {
  key: string;
  description: string;
  required: boolean;
  validate?: (val: string) => boolean;
  validationMessage?: string;
}

const ENV_SPEC: EnvSpec[] = [
  { key: 'DATABASE_URL', description: 'PostgreSQL connection string', required: true },
  { key: 'CLERK_SECRET_KEY', description: 'Clerk server-side secret key', required: true },
  { key: 'CLERK_WEBHOOK_SECRET', description: 'Clerk webhook signing secret', required: true },
  {
    key: 'ENCRYPTION_KEY',
    description: 'AES-256 key for SIN encryption (64 hex chars)',
    required: true,
    validate: (v) => /^[0-9a-fA-F]{64}$/.test(v),
    validationMessage: 'Must be exactly 64 hexadecimal characters. Generate with: openssl rand -hex 32',
  },
  { key: 'AWS_ACCESS_KEY_ID', description: 'AWS access key for S3', required: false },
  { key: 'AWS_SECRET_ACCESS_KEY', description: 'AWS secret key for S3', required: false },
  { key: 'S3_BUCKET', description: 'S3 bucket name for document storage', required: false },
  { key: 'CORS_ORIGIN', description: 'Allowed CORS origin', required: false },
];

export function validateEnv(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const spec of ENV_SPEC) {
    const val = process.env[spec.key];
    if (!val) {
      if (spec.required) {
        errors.push(`  ✗ ${spec.key}: ${spec.description}`);
      } else {
        warnings.push(`  ⚠ ${spec.key}: ${spec.description} (optional, some features disabled)`);
      }
    } else if (spec.validate && !spec.validate(val)) {
      errors.push(`  ✗ ${spec.key}: ${spec.validationMessage ?? 'Invalid value'}`);
    }
  }

  if (warnings.length > 0) {
    console.warn('\nClearPath UW — Optional env vars not set:\n' + warnings.join('\n') + '\n');
  }

  if (errors.length > 0) {
    console.error('\nClearPath UW — Required env vars missing or invalid:\n' + errors.join('\n'));
    console.error('\nSee .env.example for documentation. Exiting.\n');
    process.exit(1);
  }
}
