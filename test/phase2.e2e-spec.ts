import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

// La BD compartida tiene latencia alta: varias operaciones (crear compra,
// editar venta) hacen muchas queries secuenciales y superan los 5s por defecto.
jest.setTimeout(30000);

describe('Fase 2 — CRUD (compras, categorías, ventas)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let companyId: number;

  let supplierId: number;
  let supplier2Id: number;
  let plainProductId: number;
  let sizedProductId: number;
  let purchaseId: number;
  let categoryId: number;
  let freeCategoryId: number;
  let clientId: number;
  let saleId: number;
  let paidSaleId: number;
  let registerId: number;

  const ts = Date.now();
  const email = `fase2-${ts}@test.local`;
  const auth = () => ({ Authorization: `Bearer ${token}` });

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

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        user: 'Fase2',
        email,
        password: 'test1234',
        accountType: 'PERSONA',
      })
      .expect(200);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'test1234' })
      .expect(200);
    token = (login.body as { access_token: string }).access_token;
    const user = await prisma.user.findUnique({ where: { email } });
    companyId = user!.companyId!;

    // El plan free no incluye la vista "caja"; se sube a basico para poder
    // abrir caja y crear ventas (mismo patrón que security.e2e-spec con pro).
    const basico = await prisma.plan.findUnique({ where: { key: 'basico' } });
    const subscription = await prisma.subscription.findUnique({
      where: { companyId },
    });
    await prisma.subscription.update({
      where: { id: subscription!.id },
      data: { planId: basico!.id },
    });

    const supplier = await request(app.getHttpServer())
      .post('/suppliers')
      .set(auth())
      .send({
        name: 'Proveedor Fase2',
        document: '900-1',
        email: 'prov@f2.local',
        phone: '1',
        address: 'Calle 1',
      })
      .expect(200);
    supplierId = (supplier.body as { id: number }).id;

    const supplier2 = await request(app.getHttpServer())
      .post('/suppliers')
      .set(auth())
      .send({
        name: 'Proveedor Fase2 B',
        document: '900-2',
        email: 'prov2@f2.local',
        phone: '2',
        address: 'Calle 2',
      })
      .expect(200);
    supplier2Id = (supplier2.body as { id: number }).id;

    const plain = await request(app.getHttpServer())
      .post('/products')
      .set(auth())
      .send({
        name: 'Prod F2 simple',
        code: 'F2-PLAIN',
        purchasePrice: 10,
        salePrice: 20,
        stock: 10,
        sku: 'F2-PLAIN',
        type: 'ropa',
        category: 'Ropa',
      })
      .expect(200);
    plainProductId = (plain.body as { id: number }).id;

    const sized = await request(app.getHttpServer())
      .post('/products')
      .set(auth())
      .send({
        name: 'Prod F2 tallas',
        code: 'F2-SIZED',
        purchasePrice: 10,
        salePrice: 20,
        stock: 5,
        sku: 'F2-SIZED',
        type: 'ropa',
        category: 'Ropa',
        sizes: [{ size: 'M', stock: 5 }],
      })
      .expect(200);
    sizedProductId = (sized.body as { id: number }).id;
  }, 60000);

  afterAll(async () => {
    try {
      const saleIds = [saleId, paidSaleId].filter((id) => id > 0);
      if (saleIds.length > 0) {
        await prisma.cashMovement.deleteMany({
          where: { saleId: { in: saleIds } },
        });
        await prisma.invoice.deleteMany({ where: { saleId: { in: saleIds } } });
        await prisma.saleItem.deleteMany({ where: { saleId: { in: saleIds } } });
        await prisma.sale.deleteMany({ where: { id: { in: saleIds } } });
      }
      if (registerId) {
        await prisma.cashMovement.deleteMany({
          where: { cashRegisterId: registerId },
        });
        await prisma.cashRegister.deleteMany({ where: { id: registerId } });
      }
      if (clientId) {
        await prisma.client.deleteMany({ where: { id: clientId } });
      }
      const purchases = await prisma.purchase.findMany({
        where: { companyId },
        select: { id: true },
      });
      await prisma.purchaseItem.deleteMany({
        where: { purchaseId: { in: purchases.map((p) => p.id) } },
      });
      await prisma.purchase.deleteMany({ where: { companyId } });
      await prisma.product.deleteMany({ where: { companyId } });
      await prisma.category.deleteMany({ where: { companyId } });
      await prisma.supplier.deleteMany({ where: { companyId } });
      await prisma.client.deleteMany({ where: { companyId } });
      await prisma.subscription
        .delete({ where: { companyId } })
        .catch(() => {});
      await prisma.user.delete({ where: { email } }).catch(() => {});
      await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
    } catch (error) {
      // El cleanup no debe impedir cerrar la app (deja handlers abiertos)
      console.error('Cleanup error:', error);
    } finally {
      await app.close();
    }
  }, 60000);

  const getStock = async (id: number) => {
    const res = await request(app.getHttpServer())
      .get(`/products/${id}`)
      .set(auth())
      .expect(200);
    return res.body as { stock: number; sizes?: { size: string; stock: number }[] };
  };

  describe('2.1 Compras: editar metadatos y eliminar con reversión de stock', () => {
    it('POST /purchases incrementa el stock (con y sin tallas)', async () => {
      const res = await request(app.getHttpServer())
        .post('/purchases')
        .set(auth())
        .send({
          supplierId,
          date: '2026-09-01',
          paymentStatus: 'pending',
          items: [
            {
              productId: plainProductId,
              productName: 'Prod F2 simple',
              quantity: 3,
              unitPrice: 10,
              subtotal: 30,
            },
            {
              productId: sizedProductId,
              productName: 'Prod F2 tallas',
              size: 'M',
              quantity: 2,
              unitPrice: 10,
              subtotal: 20,
            },
          ],
        })
        .expect(200);
      purchaseId = (res.body as { id: number }).id;

      const plain = await getStock(plainProductId);
      expect(plain.stock).toBe(13);
      const sized = await getStock(sizedProductId);
      expect(sized.stock).toBe(7);
      expect(sized.sizes?.[0].stock).toBe(7);
    });

    it('PATCH /purchases/:id edita proveedor, fecha y estado de pago', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/purchases/${purchaseId}`)
        .set(auth())
        .send({
          supplierId: supplier2Id,
          date: '2026-01-15',
          paymentStatus: 'paid',
        })
        .expect(200);
      expect((res.body as { supplierId: number }).supplierId).toBe(supplier2Id);
      expect((res.body as { date: string }).date.startsWith('2026-01-15')).toBe(
        true,
      );
      expect((res.body as { paymentStatus: string }).paymentStatus).toBe(
        'paid',
      );
      // El stock no cambia al editar solo metadatos
      const plain = await getStock(plainProductId);
      expect(plain.stock).toBe(13);
    });

    it('PATCH /purchases/:id con estado inválido → 400', async () => {
      await request(app.getHttpServer())
        .patch(`/purchases/${purchaseId}`)
        .set(auth())
        .send({ paymentStatus: 'cancelled' })
        .expect(400);
    });

    it('DELETE /purchases/:id revierte el stock al valor previo', async () => {
      await request(app.getHttpServer())
        .delete(`/purchases/${purchaseId}`)
        .set(auth())
        .expect(200);

      const plain = await getStock(plainProductId);
      expect(plain.stock).toBe(10);
      const sized = await getStock(sizedProductId);
      expect(sized.stock).toBe(5);
      expect(sized.sizes?.[0].stock).toBe(5);

      const remaining = await prisma.purchase.findFirst({
        where: { id: purchaseId },
      });
      expect(remaining).toBeNull();
    });

    it('DELETE /purchases/:id inexistente → 404', async () => {
      await request(app.getHttpServer())
        .delete('/purchases/999999')
        .set(auth())
        .expect(404);
    });
  });

  describe('2.2 Categorías: CRUD y FK en producto', () => {
    it('POST /categories crea con código autogenerado', async () => {
      const res = await request(app.getHttpServer())
        .post('/categories')
        .set(auth())
        .send({ name: 'Fase2 Cat' })
        .expect(201);
      categoryId = (res.body as { id: number }).id;
      expect((res.body as { code: string }).code).toMatch(/^CAT-/);
    });

    it('POST /categories nombre duplicado → 400', async () => {
      await request(app.getHttpServer())
        .post('/categories')
        .set(auth())
        .send({ name: 'fase2 cat' })
        .expect(400);
    });

    it('GET /categories/all incluye la categoría creada', async () => {
      const res = await request(app.getHttpServer())
        .get('/categories/all')
        .set(auth())
        .expect(200);
      const names = (res.body as { name: string }[]).map((c) => c.name);
      expect(names).toContain('Fase2 Cat');
    });

    it('Crear producto con categoryId enlaza y sincroniza el nombre', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .set(auth())
        .send({
          name: 'Prod F2 categoria',
          code: 'F2-CAT',
          purchasePrice: 5,
          salePrice: 9,
          stock: 1,
          sku: 'F2-CAT',
          type: 'ropa',
          categoryId,
        })
        .expect(200);
      expect((res.body as { category: string }).category).toBe('Fase2 Cat');
      expect((res.body as { categoryId: number }).categoryId).toBe(categoryId);
    });

    it('GET /products?category= filtra por el nombre de la categoría', async () => {
      const res = await request(app.getHttpServer())
        .get('/products')
        .query({ category: 'Fase2 Cat' })
        .set(auth())
        .expect(200);
      const rows = (res.body as { data: { name: string }[] }).data;
      expect(rows.map((p) => p.name)).toContain('Prod F2 categoria');
    });

    it('DELETE /categories con productos asignados → 400', async () => {
      await request(app.getHttpServer())
        .delete(`/categories/${categoryId}`)
        .set(auth())
        .expect(400);
    });

    it('PATCH /categories renombra y sincroniza el nombre en productos', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/categories/${categoryId}`)
        .set(auth())
        .send({ name: 'Fase2 Cat Ok' })
        .expect(200);
      expect((res.body as { name: string }).name).toBe('Fase2 Cat Ok');

      const raw = await prisma.product.findFirst({
        where: { companyId, code: 'F2-CAT' },
      });
      expect(raw!.category).toBe('Fase2 Cat Ok');
    });

    it('DELETE /categories sin productos → 200', async () => {
      const created = await request(app.getHttpServer())
        .post('/categories')
        .set(auth())
        .send({ name: 'Fase2 Cat Libre' })
        .expect(201);
      freeCategoryId = (created.body as { id: number }).id;

      await request(app.getHttpServer())
        .delete(`/categories/${freeCategoryId}`)
        .set(auth())
        .expect(200);
    });
  });

  describe('2.3 Ventas: allowlist de edición en pending', () => {
    it('Abre caja y crea una venta pending descontando stock', async () => {
      const open = await request(app.getHttpServer())
        .post('/cash-registers/open')
        .set(auth())
        .send({ baseAmount: 0 })
        .expect(201);
      registerId = (open.body as { id: number }).id;

      const res = await request(app.getHttpServer())
        .post('/sales')
        .set(auth())
        .send({
          date: '2026-09-10',
          paymentStatus: 'pending',
          paymentMethod: 'cash',
          items: [
            {
              productId: plainProductId,
              productName: 'Prod F2 simple',
              quantity: 2,
              unitPrice: 20,
              subtotal: 40,
            },
          ],
        })
        .expect(200);
      // POST /sales responde { sale, invoice }
      saleId = (res.body as { sale: { id: number } }).sale.id;

      const stock = await getStock(plainProductId);
      expect(stock.stock).toBe(8);
    });

    it('PUT /sales/:id edita líneas, recalcula totales y ajusta stock', async () => {
      const res = await request(app.getHttpServer())
        .put(`/sales/${saleId}`)
        .set(auth())
        .send({
          notes: 'Observación de prueba',
          items: [
            {
              productId: plainProductId,
              productName: 'Prod F2 simple',
              quantity: 1,
              unitPrice: 20,
              subtotal: 20,
            },
          ],
        })
        .expect(200);

      const body = res.body as {
        subtotal: number;
        tax: number;
        total: number;
        notes: string;
        items: { quantity: number }[];
      };
      expect(body.subtotal).toBe(20);
      expect(body.tax).toBe(4);
      expect(body.total).toBe(24);
      expect(body.notes).toBe('Observación de prueba');
      expect(body.items).toHaveLength(1);

      // 1 unidad devuelta al stock: 8 → 9
      const stock = await getStock(plainProductId);
      expect(stock.stock).toBe(9);

      // La factura queda sincronizada
      const invoice = await prisma.invoice.findFirst({ where: { saleId } });
      expect(invoice!.subtotal).toBe(20);
      expect(invoice!.total).toBe(24);
    });

    it('PUT /sales/:id cambia el cliente', async () => {
      const client = await request(app.getHttpServer())
        .post('/client/create')
        .set(auth())
        .send({
          name: 'Cliente Fase2',
          phone: '300',
          address: 'Cra 1',
          document: 'CC-1',
          email: 'cliente-f2@f2.local',
        })
        .expect(201);
      clientId = (client.body as { id: number }).id;

      const res = await request(app.getHttpServer())
        .put(`/sales/${saleId}`)
        .set(auth())
        .send({ clientId })
        .expect(200);
      expect((res.body as { clientId: number }).clientId).toBe(clientId);

      const invoice = await prisma.invoice.findFirst({ where: { saleId } });
      expect(invoice!.clientId).toBe(clientId);
      expect(invoice!.clientName).toBe('Cliente Fase2');
    });

    it('PUT /sales/:id con campos fuera de la allowlist → 400', async () => {
      await request(app.getHttpServer())
        .put(`/sales/${saleId}`)
        .set(auth())
        .send({ paymentStatus: 'paid' })
        .expect(400);
    });

    it('PUT /sales/:id en venta paid rechaza edición de líneas pero admite notas', async () => {
      await request(app.getHttpServer())
        .patch(`/sales/${saleId}`)
        .set(auth())
        .send({ paymentStatus: 'paid', paymentMethod: 'cash' })
        .expect(200);
      paidSaleId = saleId;
      saleId = 0;

      await request(app.getHttpServer())
        .put(`/sales/${paidSaleId}`)
        .set(auth())
        .send({ items: [] })
        .expect(400);

      const res = await request(app.getHttpServer())
        .put(`/sales/${paidSaleId}`)
        .set(auth())
        .send({ notes: 'Solo notas en venta pagada' })
        .expect(200);
      expect((res.body as { notes: string }).notes).toBe(
        'Solo notas en venta pagada',
      );
    });

    it('PUT /sales/:id en venta cancelled → 400 para líneas', async () => {
      await request(app.getHttpServer())
        .patch(`/sales/${paidSaleId}`)
        .set(auth())
        .send({ paymentStatus: 'cancelled', cancelledReason: 'prueba' })
        .expect(200);

      await request(app.getHttpServer())
        .put(`/sales/${paidSaleId}`)
        .set(auth())
        .send({ paymentMethod: 'card' })
        .expect(400);
    });
  });
});
