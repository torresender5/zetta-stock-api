# AGENTS.md - NestJS API Development Guide

## Project Overview
This is a NestJS REST API with Prisma ORM, PostgreSQL, Jest testing, and Swagger documentation.

## Tenancy (important)

The system is multi-tenant: `Company` (kind `PERSONA`/`EMPRESA`) is the tenant. Every business entity (`Product`, `Client`, `Supplier`, `Sale`, `Invoice`, `Purchase`, `Category`, `ProductType`) has a `companyId` column and every `User` belongs to a `Company`. The JWT payload carries `companyId`/`companyKind`/`companyName`; services scope every query and inject `companyId` on create. `UserAdmin` (Basic auth) is a global superadmin with no `companyId` (its requests skip the tenant filter). Do not add a module that reads business data without scoping by `req.user.companyId`. `companyId` is nullable in the schema only because legacy data was backfilled to the admin company; new records always set it.

## Commands

### Development
```bash
# Start in watch mode
npm run start:dev

# Start in debug mode
npm run start:debug

# Start production build
npm run start:prod
```

### Build & Lint
```bash
# Build the project
npm run build

# Lint and fix
npm run lint

# Format code
npm run format
```

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run a single test file
npx jest src/product/product.controller.spec.ts

# Run a single test
npx jest --testNamePattern="findAll" src/product/product.controller.spec.ts

# Run e2e tests
npm run test:e2e
```

### Database (Prisma)
```bash
# Generate Prisma client
npm run prisma:generate

# Deploy migrations
npm run prisma:migrate
```

## Code Style Guidelines

### General
- Use 2 spaces for indentation
- Use single quotes for strings
- Use trailing commas everywhere
- Maximum line length: 100 characters (soft limit)

### Naming Conventions
- **Files**: kebab-case (e.g., `users.service.ts`)
- **Classes**: PascalCase (e.g., `UsersController`)
- **Interfaces**: PascalCase with optional "I" prefix avoided (e.g., `User`, not `IUser`)
- **Methods/variables**: camelCase
- **Constants**: SCREAMING_SNAKE_CASE
- **DTOs**: PascalCase with "Dto" suffix (e.g., `UserCreateDto`)
- **Modules**: PascalCase with "Module" suffix

### TypeScript
- Always define return types for functions
- Use explicit types over `any` (ESLint will warn)
- Use interfaces for object shapes
- Use Prisma types from `@prisma/client`

### Imports
- Order imports:
  1. External libraries (@nestjs/*, etc.)
  2. Internal modules (relative imports)
  3. Local files
- Use path aliases when available (e.g., `src/prisma/prisma.service`)
- Group external, then internal, then local

### NestJS Patterns

#### Controllers
```typescript
@Controller('resource')
export class ResourceController {
  constructor(
    private readonly service: ResourceService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @Get()
  findAll() {
    this.logger.info('Starting find all');
    return this.service.findAll();
  }
}
```

#### Services
```typescript
@Injectable()
export class ResourceService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private prisma: PrismaService,
  ) {}

  async findAll() {
    this.logger.info('Starting findAll');
    return this.prisma.resource.findMany();
  }
}
```

#### DTOs with Swagger
```typescript
@ApiSchema({ name: 'CreateResource' })
export class CreateResourceDto {
  @ApiProperty({ description: 'Field description' })
  @IsString()
  field: string;
}
```

### Error Handling
- Use NestJS built-in exceptions (`NotFoundException`, `BadRequestException`, etc.)
- Always wrap async operations in try-catch
- Use Winston logger for logging (already configured in project)
- Log errors with appropriate level (error, warn, info)

### Logging
- Use Winston logger via `@Inject(WINSTON_MODULE_PROVIDER)`
- Include descriptive messages: `this.logger.info('Starting operation')`
- Log errors: `this.logger.error('Error message', error.stack)`

### Testing
- Test files: `*.spec.ts` in same directory as source
- Use `@nestjs/testing` utilities
- Follow AAA pattern: Arrange, Act, Assert

### API Documentation
- Use Swagger decorators (`@ApiProperty`, `@ApiSchema`, etc.)
- Add `@ApiTags('resource')` to controllers
- Document all DTOs with `@ApiProperty`

## File Structure
```
src/
├── main.ts                 # Application entry
├── app.module.ts           # Root module
├── config/                 # Configuration
├── prisma/                 # Prisma module
├── email/                  # Email module
├── users/                  # Users module
│   ├── dto/
│   ├── interface/
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── users.module.ts
├── product/                # Product module
├── client/                 # Client module
└── images/                 # Static assets
```
