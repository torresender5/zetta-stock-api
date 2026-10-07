import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

// La BD compartida tiene latencia alta: el alta de empresa crea producto,
// caja y venta con muchas queries secuenciales.
jest.setTimeout(30000);

type BinaryParser = (
  res: request.Response,
  callback: (err: Error | null, body?: Buffer) => void,
) => void;

const binaryParser: BinaryParser = (res, callback) => {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
};

interface TenantFixture {
  token: string;
  companyId: number;
  productId: number;
  registerId: number;
  saleId: number;
  invoiceId: number;
}

describe('Fase 3 — Facturación y rendimiento', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let tenantA: TenantFixture;
  let tenantB: TenantFixture;
  let freeToken: string;

  const ts = Date.now();
  const emailA = `fase3a-${ts}@test.local`;
  const emailB = `fase3b-${ts}@test.local`;
  const emailFree = `fase3free-${ts}@test.local`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const createTenant = async (
    label: string,
    email: string,
  ): Promise<TenantFixture> => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        user: `Fase3 ${label}`,
        email,
        password: 'test1234',
        accountType: 'PERSONA',
      })
      .expect(200);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'test1234' })
      .expect(200);
    const token = (login.body as { access_token: string }).access_token;

    const user = await prisma.user.findUnique({ where: { email } });
    const companyId = user!.companyId!;

    // El plan free no incluye la vista "caja": se sube a basico para poder
    // abrir caja y registrar la venta (mismo patrón que phase2/security).
    const basico = await prisma.plan.findUnique({ where: { key: 'basico' } });
    const subscription = await prisma.subscription.findUnique({
      where: { companyId },
    });
    await prisma.subscription.update({
      where: { id: subscription!.id },
      data: { planId: basico!.id },
    });

    const code = `F3-${label}-${ts}`;
    const product = await request(app.getHttpServer())
      .post('/products')
      .set(auth(token))
      .send({
        name: `Prod F3 ${label}`,
        code,
        purchasePrice: 10,
        salePrice: 20,
        stock: 5,
        sku: code,
        type: 'ropa',
        category: 'Ropa',
      })
      .expect(200);
    const productId = (product.body as { id: number }).id;

    const open = await request(app.getHttpServer())
      .post('/cash-registers/open')
      .set(auth(token))
      .send({ baseAmount: 0 })
      .expect(201);
    const registerId = (open.body as { id: number }).id;

    const sale = await request(app.getHttpServer())
      .post('/sales')
      .set(auth(token))
      .send({
        date: '2026-10-01',
        paymentStatus: 'pending',
        paymentMethod: 'cash',
        items: [
          {
            productId,
            productName: `Prod F3 ${label}`,
            quantity: 1,
            unitPrice: 20,
            subtotal: 20,
          },
        ],
      })
      .expect(200);
    const body = sale.body as {
      sale: { id: number };
      invoice: { id: number };
    };

    return {
      token,
      companyId,
      productId,
      registerId,
      saleId: body.sale.id,
      invoiceId: body.invoice.id,
    };
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    // Mismo pipe global que main.ts: sin él la validación de DTOs (IsIn,
    // forbidNonWhitelisted) no se ejercita en los tests.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    tenantA = await createTenant('A', emailA);
    tenantB = await createTenant('B', emailB);

    // Empresa sin suscripción de pago (plan free) para el gating de vistas.
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        user: 'Fase3 Free',
        email: emailFree,
        password: 'test1234',
        accountType: 'PERSONA',
      })
      .expect(200);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: emailFree, password: 'test1234' })
      .expect(200);
    freeToken = (login.body as { access_token: string }).access_token;
  }, 120000);

  afterAll(async () => {
    if (!app) return;
    try {
      if (prisma) {
        for (const email of [emailA, emailB, emailFree]) {
          const user = await prisma.user.findUnique({ where: { email } });
          const companyId = user?.companyId;
          if (!companyId) continue;

          const sales = await prisma.sale.findMany({
            where: { companyId },
            select: { id: true },
          });
          const saleIds = sales.map((s) => s.id);
          await prisma.cashMovement.deleteMany({
            where: { saleId: { in: saleIds } },
          });
          await prisma.invoice.deleteMany({
            where: { saleId: { in: saleIds } },
          });
          await prisma.saleItem.deleteMany({
            where: { saleId: { in: saleIds } },
          });
          await prisma.sale.deleteMany({ where: { companyId } });
          await prisma.cashMovement.deleteMany({ where: { companyId } });
          await prisma.cashRegister.deleteMany({ where: { companyId } });
          await prisma.product.deleteMany({ where: { companyId } });
          await prisma.category.deleteMany({ where: { companyId } });
          await prisma.client.deleteMany({ where: { companyId } });
          await prisma.subscription
            .delete({ where: { companyId } })
            .catch(() => {});
          await prisma.user.delete({ where: { email } }).catch(() => {});
          await prisma.company
            .delete({ where: { id: companyId } })
            .catch(() => {});
        }
      }
    } catch (error) {
      // El cleanup no debe impedir cerrar la app (deja handlers abiertos)
      console.error('Cleanup error:', error);
    } finally {
      await app.close();
    }
  }, 60000);

  describe('3.1 PDF de la factura', () => {
    it('GET /invoices/:id/export?format=pdf devuelve un PDF real', async () => {
      const res = await request(app.getHttpServer())
        .get(`/invoices/${tenantA.invoiceId}/export`)
        .query({ format: 'pdf' })
        .buffer(true)
        .parse(binaryParser)
        .set(auth(tenantA.token))
        .expect(200);

      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('.pdf');
      const pdf = res.body as Buffer;
      expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
      expect(pdf.length).toBeGreaterThan(500);
    });

    it('GET /invoices/:id/export sin format también devuelve PDF', async () => {
      await request(app.getHttpServer())
        .get(`/invoices/${tenantA.invoiceId}/export`)
        .buffer(true)
        .parse(binaryParser)
        .set(auth(tenantA.token))
        .expect(200);
    });

    it('GET /invoices/:id/export con formato desconocido → 400', async () => {
      await request(app.getHttpServer())
        .get(`/invoices/${tenantA.invoiceId}/export`)
        .query({ format: 'csv' })
        .set(auth(tenantA.token))
        .expect(400);
    });

    it('GET /invoices/:id/export de otra empresa → 404 (scoping)', async () => {
      await request(app.getHttpServer())
        .get(`/invoices/${tenantB.invoiceId}/export`)
        .query({ format: 'pdf' })
        .set(auth(tenantA.token))
        .expect(404);
    });

    it('GET /invoices/:id/export inexistente → 404', async () => {
      await request(app.getHttpServer())
        .get('/invoices/999999/export')
        .query({ format: 'pdf' })
        .set(auth(tenantA.token))
        .expect(404);
    });

    it('GET /invoices/:id/export sin token → 401', async () => {
      await request(app.getHttpServer())
        .get(`/invoices/${tenantA.invoiceId}/export`)
        .query({ format: 'pdf' })
        .expect(401);
    });
  });

  describe('3.3 Listado paginado y conteos de facturas', () => {
    it('GET /invoices devuelve data + meta paginados', async () => {
      const res = await request(app.getHttpServer())
        .get('/invoices')
        .query({ page: 1, limit: 1 })
        .set(auth(tenantA.token))
        .expect(200);

      const body = res.body as {
        data: { id: number; sale?: { items?: unknown[] } }[];
        meta: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
        };
      };
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.meta.limit).toBe(1);
      expect(body.meta.page).toBe(1);
      expect(body.meta.total).toBeGreaterThanOrEqual(1);
      expect(body.meta.totalPages).toBeGreaterThanOrEqual(1);
      // La factura lleva sus líneas para poder pintarla / exportarla
      expect(body.data[0].sale?.items?.length).toBeGreaterThan(0);
    });

    it('GET /invoices filtra por estado', async () => {
      const res = await request(app.getHttpServer())
        .get('/invoices')
        .query({ status: 'pending' })
        .set(auth(tenantA.token))
        .expect(200);
      const rows = (res.body as { data: { status: string }[] }).data;
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((row) => row.status === 'pending')).toBe(true);

      await request(app.getHttpServer())
        .get('/invoices')
        .query({ status: 'cancelled' })
        .set(auth(tenantA.token))
        .expect(200)
        .expect((res2) => {
          const data = (res2.body as { data: unknown[] }).data;
          expect(Array.isArray(data)).toBe(true);
        });
    });

    it('GET /invoices filtra por búsqueda y devuelve 0 sin coincidencias', async () => {
      const match = await request(app.getHttpServer())
        .get('/invoices')
        .query({ search: 'FAC-' })
        .set(auth(tenantA.token))
        .expect(200);
      expect(
        (match.body as { meta: { total: number } }).meta.total,
      ).toBeGreaterThan(0);

      const none = await request(app.getHttpServer())
        .get('/invoices')
        .query({ search: `no-existe-${ts}` })
        .set(auth(tenantA.token))
        .expect(200);
      const noneBody = none.body as {
        data: unknown[];
        meta: { total: number };
      };
      expect(noneBody.data).toHaveLength(0);
      expect(noneBody.meta.total).toBe(0);
    });

    it('GET /invoices con page fuera de rango → 400', async () => {
      await request(app.getHttpServer())
        .get('/invoices')
        .query({ page: 0 })
        .set(auth(tenantA.token))
        .expect(400);
    });

    it('GET /invoices sin token → 401', async () => {
      await request(app.getHttpServer()).get('/invoices').expect(401);
    });

    it('GET /invoices/stats cuenta por estado solo de la propia empresa', async () => {
      const res = await request(app.getHttpServer())
        .get('/invoices/stats')
        .set(auth(tenantA.token))
        .expect(200);
      const stats = res.body as {
        paid: number;
        pending: number;
        cancelled: number;
        total: number;
      };
      // Cada empresa creó exactamente una factura pendiente en el alta
      expect(stats.total).toBe(1);
      expect(stats.pending).toBe(1);
      expect(stats.paid).toBe(0);
      expect(stats.cancelled).toBe(0);
      expect(stats.paid + stats.pending + stats.cancelled).toBe(stats.total);
    });

    it('GET /invoices/stats respeta búsqueda', async () => {
      const res = await request(app.getHttpServer())
        .get('/invoices/stats')
        .query({ search: `no-existe-${ts}` })
        .set(auth(tenantA.token))
        .expect(200);
      expect((res.body as { total: number }).total).toBe(0);
    });

    it('el listado de una empresa no contiene facturas de la otra', async () => {
      const res = await request(app.getHttpServer())
        .get('/invoices')
        .query({ limit: 100 })
        .set(auth(tenantA.token))
        .expect(200);
      const ids = (res.body as { data: { id: number }[] }).data.map(
        (row) => row.id,
      );
      expect(ids).toContain(tenantA.invoiceId);
      expect(ids).not.toContain(tenantB.invoiceId);
    });
  });

  describe('Resumen del dashboard (GET /dashboard/summary)', () => {
    it('devuelve resumen de ventas, top productos y top clientes', async () => {
      const res = await request(app.getHttpServer())
        .get('/dashboard/summary')
        .query({ excludeCancelled: 'true' })
        .set(auth(tenantA.token))
        .expect(200);

      const body = res.body as {
        sales: {
          totalSales: number;
          totalCount: number;
          byPeriod: { date: string; count: number; total: number }[];
        };
        topProducts: { productId: number; quantity: number }[];
        topClients: { clientId: number; name: string; totalSpent: number }[];
      };
      expect(body.sales.totalSales).toBeGreaterThan(0);
      expect(body.sales.totalCount).toBeGreaterThanOrEqual(1);
      expect(body.sales.byPeriod.length).toBeGreaterThanOrEqual(1);
      expect(body.topProducts.length).toBeGreaterThanOrEqual(1);
      expect(body.topProducts[0].quantity).toBeGreaterThan(0);
      expect(body.topClients.length).toBeGreaterThanOrEqual(1);
      expect(body.topClients[0].name).toBeTruthy();
      expect(body.topClients[0].totalSpent).toBeGreaterThan(0);
    });

    it('el rango de fechas excluye ventas fuera del intervalo', async () => {
      const res = await request(app.getHttpServer())
        .get('/dashboard/summary')
        .query({ startDate: '2020-01-01', endDate: '2020-01-31' })
        .set(auth(tenantA.token))
        .expect(200);
      const body = res.body as {
        sales: { totalSales: number; totalCount: number };
        topProducts: unknown[];
        topClients: unknown[];
      };
      expect(body.sales.totalSales).toBe(0);
      expect(body.sales.totalCount).toBe(0);
      expect(body.topProducts).toHaveLength(0);
      expect(body.topClients).toHaveLength(0);
    });

    it('sin token → 401', async () => {
      await request(app.getHttpServer()).get('/dashboard/summary').expect(401);
    });

    it('está disponible para el plan free (vista dashboard)', async () => {
      await request(app.getHttpServer())
        .get('/dashboard/summary')
        .set(auth(freeToken))
        .expect(200);

      // ...mientras que /reports sigue reservado a planes que incluyen reports
      const denied = await request(app.getHttpServer())
        .get('/reports/sales')
        .set(auth(freeToken))
        .expect(403);
      expect((denied.body as { code?: string }).code).toBe('PLAN_VIEW_DENIED');
    });
  });
});
