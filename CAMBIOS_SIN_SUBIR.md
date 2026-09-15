# Resumen de cambios sin subir (rama `main`)

Todo está sin commitear: 13 archivos modificados + archivos nuevos.

## Módulos nuevos (untracked)

**CRUDs completos** (controller + service + module + DTO), registrados en `app.module.ts`:

- `src/client/` — Clientes (`/client`): CRUD completo
- `src/supplier/` — Proveedores (`/suppliers`): CRUD completo
- `src/sale/` — Ventas (`/sales`) + Facturas (`/invoices`)
- `src/purchase/` — Compras (`/purchases`)

## Autenticación

- `src/auth/any-auth.guard.ts` — `AnyAuthGuard`: acepta **JWT Bearer o Basic Auth** contra la tabla `UserAdmin`
- `src/auth/auth.decorator.ts` — decorador `@Auth()` que combina guard + Swagger (`ApiBearerAuth`/`ApiBasicAuth`)
- `prisma/schemas/user-admin.prisma` — modelo `UserAdmin`

## Prisma

- Nuevos schemas: `sale.prisma` (Sale, SaleItem, Invoice), `purchase.prisma` (Purchase, PurchaseItem), `supplier.prisma`, `user-admin.prisma`
- `product.prisma`: `price` → `purchasePrice`/`salePrice`, agrega `image`, `sizes` (Json), `updatedAt`, relaciones con SaleItem/PurchaseItem
- `client.prisma`: relaciones con Sales/Invoices; `commom.prisma`: formateo y relación Person→User obligatoria
- `prisma/seed.ts` — seed de productos de ropa (desde `~/Projects/store/data/products.ts`), calcula stock/precios y crea un UserAdmin; configurado en `package.json` (`prisma.seed`)

## Producto (mejoras al módulo existente)

- Ruta renombrada `/product` → `/products`; endpoints nuevos `PATCH :id`, `DELETE :id`, `GET :id` por `@Param`
- `GET /products` ahora con **paginación + búsqueda** (name/sku/code) y filtro por categoría (`dto/pagination.dto.ts` nuevo)
- DTO: `ProductSizeDto` (talla + stock), `image`, `UpdateProductDto` (PartialType); schemas renombrados en Swagger (`CreateProduct`, `CreateUser`)

## Otros

- `main.ts`: Swagger con `.addBearerAuth()` y `.addBasicAuth()`
- `TODO.md`: reemplazado por una sola línea pendiente ("Fix product.controller.ts @Param")
- ⚠️ `console.log` de debug agregados en `auth.controller.ts` y `users.service.ts` (candidatos a eliminar antes de subir)
- `AGENTS.md` nuevo (guía de desarrollo del proyecto)
