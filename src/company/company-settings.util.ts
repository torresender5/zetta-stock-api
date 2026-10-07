import { PrismaService } from 'src/prisma/prisma.service';

export interface CompanySettings {
  id: number | null;
  name: string | null;
  kind: string | null;
  document: string | null;
  phoneNumber: string | null;
  address: string | null;
  description: string | null;
  currency: string;
  taxRate: number;
  invoicePrefix: string;
  salePrefix: string;
  logoUrl: string | null;
}

/** Valores por defecto cuando la empresa no existe o no tiene configuración. */
export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  id: null,
  name: null,
  kind: null,
  document: null,
  phoneNumber: null,
  address: null,
  description: null,
  currency: 'USD',
  taxRate: 19,
  invoicePrefix: 'FAC',
  salePrefix: 'VEN',
  logoUrl: null,
};

const SELECT = {
  id: true,
  name: true,
  kind: true,
  document: true,
  phoneNumber: true,
  address: true,
  description: true,
  currency: true,
  taxRate: true,
  invoicePrefix: true,
  salePrefix: true,
  logoUrl: true,
};

/**
 * Devuelve la configuración de la empresa (moneda base, % IVA, numeración).
 * Los superadmin (sin companyId) y los datos heredados reciben los defaults.
 */
export async function getCompanySettings(
  prisma: PrismaService,
  companyId?: number,
): Promise<CompanySettings> {
  if (!companyId) {
    return DEFAULT_COMPANY_SETTINGS;
  }
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: SELECT,
  });
  if (!company) {
    return DEFAULT_COMPANY_SETTINGS;
  }
  return { ...DEFAULT_COMPANY_SETTINGS, ...company };
}

/** % de IVA efectivo (0–100) para la empresa; 19 si no hay configuración. */
export async function getCompanyTaxRate(
  prisma: PrismaService,
  companyId?: number,
): Promise<number> {
  const settings = await getCompanySettings(prisma, companyId);
  return settings.taxRate;
}
