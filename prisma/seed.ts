import { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TOTAL_STOCK = 50;
const PURCHASE_PRICE_RATE = 0.6;

interface SourceProduct {
  name: string;
  price: number;
  description: string;
  category: string;
  image: string;
  sizes: string[];
}

// Fuente: ~/Projects/store/data/products.ts
const sourceProducts: SourceProduct[] = [
  {
    name: 'Camisa Linen Clásica',
    price: 89.99,
    description:
      'Camisa de lino 100% natural, ideal para los días cálidos. Corte regular con botones de nácar y bolso pechera. Tela transpirable y ligera que brinda comodidad todo el día.',
    category: 'hombre',
    image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=500&fit=crop',
    sizes: ['S', 'M', 'L', 'XL'],
  },
  {
    name: 'Jeans Slim Fit Dark',
    price: 119.99,
    description:
      'Jeans de mezclilla premium con corte slim fit moderno. Lavado oscuro que combina con todo. Elastano integrado para mayor movimiento y comfort.',
    category: 'hombre',
    image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=500&fit=crop',
    sizes: ['28', '30', '32', '34', '36'],
  },
  {
    name: 'Polo Deportivo Tech',
    price: 69.99,
    description:
      'Polo con tecnología dry-fit que absorbe la humedad. Perfecto para el gimnasio o uso casual. Cuello clásico con logo bordado.',
    category: 'hombre',
    image: 'https://images.unsplash.com/photo-1625910513413-5fc42ffe9cc0?w=400&h=500&fit=crop',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
  },
  {
    name: 'Chaqueta Bomber Premium',
    price: 189.99,
    description:
      'Chaqueta bomber de nylon resistente con forro interior acolchado. Cierre frontal con cierre metálico, bolsillos laterales con cierre y elástico en puños y cintura.',
    category: 'hombre',
    image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=500&fit=crop',
    sizes: ['M', 'L', 'XL'],
  },
  {
    name: 'Sudadera Oversized',
    price: 79.99,
    description:
      'Sudadera de algodón reciclado con corte oversize moderno. Capucha ajustable con cordón, bolsillo canguro y costuras reforzadas. Tela gruesa de 350gsm.',
    category: 'hombre',
    image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=500&fit=crop',
    sizes: ['S', 'M', 'L', 'XL'],
  },
  {
    name: 'Camiseta Básica Premium',
    price: 39.99,
    description:
      'Camiseta de algodón orgánico 100% de alta densidad. Corte regular, cuello redondo con rib reforzado que no deformable. Disponible en varios colores.',
    category: 'hombre',
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=500&fit=crop',
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  },
  {
    name: 'Vestido Midi Floral',
    price: 129.99,
    description:
      'Vestido midi con estampado floral en tela viscosa fluida. Escote en V, manga larga con puño elástico y cintura marcada con cinto a juego.',
    category: 'mujer',
    image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400&h=500&fit=crop',
    sizes: ['XS', 'S', 'M', 'L'],
  },
  {
    name: 'Blusa Satin Elegante',
    price: 74.99,
    description:
      'Blusa de satén con cuello alto y manga acampanada. Tela brillante y sedosa perfecta para ocasiones especiales. Cierre invisible en la espalda.',
    category: 'mujer',
    image: 'https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=400&h=500&fit=crop',
    sizes: ['XS', 'S', 'M', 'L'],
  },
  {
    name: 'Faldá Plisada Midi',
    price: 64.99,
    description:
      'Falda plisada midi con cintura alta elástica. Tela ligera con movimiento fluido. Ideal para combinar con blusas o croptops.',
    category: 'mujer',
    image: 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=400&h=500&fit=crop',
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name: 'Top Crop Deportivo',
    price: 44.99,
    description:
      'Top deportivo cropped con soporte medio. Material de compresión con tecnología anti-odor. Ideal para yoga, pilates o uso casual.',
    category: 'mujer',
    image: 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=400&h=500&fit=crop',
    sizes: ['XS', 'S', 'M', 'L'],
  },
  {
    name: 'Jean Mom High Waist',
    price: 99.99,
    description:
      'Jean de corte mom con cintura alta y pierna recta. Lavado vintage con desgaste natural. Botones dorados y bolsillos clásicos.',
    category: 'mujer',
    image: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400&h=500&fit=crop',
    sizes: ['24', '26', '28', '30', '32'],
  },
  {
    name: 'Cardigan Largo Cozy',
    price: 89.99,
    description:
      'Cardigan largo de punto con textura cable. Tela suave y cálida, perfecta para el otoño-invierno. Bolsillos frontales y cierre de botones.',
    category: 'mujer',
    image: 'https://images.unsplash.com/photo-1434389677669-e08b4cda3a56?w=400&h=500&fit=crop',
    sizes: ['S', 'M', 'L'],
  },
  {
    name: 'Bolso Tote Cuero',
    price: 159.99,
    description:
      'Bolso tote de cuero genuino con interior forrado en gamuza. Asas reforzadas, cierre magnético y bolsillo interior con cierre. Tamaño perfecto para el día a día.',
    category: 'accesorios',
    image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=500&fit=crop',
    sizes: ['Único'],
  },
  {
    name: 'Reloj Minimalist Gold',
    price: 199.99,
    description:
      'Reloj de pulsera con diseño minimalista y caja de acero inoxidable bañada en oro. Correa de cuero genuino, cristal de zafiro y resistencia al agua.',
    category: 'accesorios',
    image: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=400&h=500&fit=crop',
    sizes: ['Único'],
  },
  {
    name: 'Gafas de Sol Aviador',
    price: 129.99,
    description:
      'Gafas de sol estilo aviador con montura de metal dorado. Lentes polarizadas con protección UV400. Estuche de cuero incluido.',
    category: 'accesorios',
    image: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&h=500&fit=crop',
    sizes: ['Único'],
  },
  {
    name: 'Cinturón Cuero Clásico',
    price: 49.99,
    description:
      'Cinturón de cuero genuino con Hebilla de acero cepillado. Ancho estándar de 3.5cm, perfecto para pantalones y jeans. Disponible en negro y marrón.',
    category: 'accesorios',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=500&fit=crop',
    sizes: ['80cm', '90cm', '100cm', '110cm'],
  },
  {
    name: 'Sombrero Fedora',
    price: 59.99,
    description:
      'Fedora de lana con cinta de terciopelo. Ala ancha y copa alta, estilo clásico que nunca pasa de moda. Interior forrado en cuero.',
    category: 'accesorios',
    image: 'https://images.unsplash.com/photo-1514327605112-8862400108fd?w=400&h=500&fit=crop',
    sizes: ['S', 'M', 'L'],
  },
  {
    name: 'Shorts Bermuda Linen',
    price: 59.99,
    description:
      'Shorts de lino con corte bermuda. Cintura con cierre de botón y cremallera, bolsillos laterales y traseros. Perfectos para el verano.',
    category: 'hombre',
    image: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=400&h=500&fit=crop',
    sizes: ['28', '30', '32', '34', '36'],
  },
  {
    name: 'Mono Largo Elegante',
    price: 149.99,
    description:
      'Mono largo de una pieza con escote palomo y manga corta. Cintura marcada con cinto a juego y pantalón recto. Tela fluida ideal para eventos.',
    category: 'mujer',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=500&fit=crop',
    sizes: ['XS', 'S', 'M', 'L'],
  },
  {
    name: 'Mochila Urban Tech',
    price: 89.99,
    description:
      'Mochila de nylon resistente al agua con compartimento para laptop de 15.6 pulgadas. Correas acolchadas ajustables, múltiples bolsillos organizadores.',
    category: 'accesorios',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=500&fit=crop',
    sizes: ['Único'],
  },
  {
    name: 'Blazer Slim Moderno',
    price: 169.99,
    description:
      'Blazer de corte slim con tejido de stretch. Solapa scoop, dos botones delanteros y bolsillo interior. Perfecto para looks formales o casual-smart.',
    category: 'hombre',
    image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&h=500&fit=crop',
    sizes: ['S', 'M', 'L', 'XL'],
  },
  {
    name: 'Camiseta Estampada Retro',
    price: 34.99,
    description:
      'Camiseta de algodón con estampado retro de los años 90. Corte regular, cuello redondo y tela suave pre-lavada que no encoge.',
    category: 'mujer',
    image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=400&h=500&fit=crop',
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name: 'Bufanda de Seda',
    price: 44.99,
    description:
      'Bufanda de seda natural con estampado geométrico. Tamaño generoso de 180x70cm. Multiples formas de usar: al cuello, como pañuelo o accesorio para bolso.',
    category: 'accesorios',
    image: 'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=400&h=500&fit=crop',
    sizes: ['Único'],
  },
  {
    name: 'Zapatillas Urban Run',
    price: 139.99,
    description:
      'Zapatillas deportivas con suela de espuma moldeada y amortiguación superior. Parte superior de malla transpirable y refuerzos de cuero sintético. Diseño urbano versátil.',
    category: 'accesorios',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=500&fit=crop',
    sizes: ['38', '39', '40', '41', '42', '43', '44'],
  },
];

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function buildSizes(sizes: string[]): Prisma.InputJsonValue {
  const base = Math.floor(TOTAL_STOCK / sizes.length);
  const remainder = TOTAL_STOCK % sizes.length;
  return sizes.map((size, i) => ({
    size,
    stock: base + (i < remainder ? 1 : 0),
  }));
}

function toProductData(source: SourceProduct, index: number) {
  return {
    name: source.name,
    description: source.description,
    code: slugify(source.name),
    purchasePrice: Math.round(source.price * PURCHASE_PRICE_RATE * 100) / 100,
    salePrice: source.price,
    stock: TOTAL_STOCK,
    sku: `SKU-${String(index + 1).padStart(3, '0')}`,
    type: source.category,
    category: source.category,
    image: source.image,
    sizes: buildSizes(source.sizes),
  };
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('ADMIN_EMAIL/ADMIN_PASSWORD no definidos, se omite el seed de UserAdmin');
    return;
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  await prisma.userAdmin.upsert({
    where: { email },
    update: {},
    create: { email, user: 'admin', password: passwordHash },
  });
  console.log(`UserAdmin listo: ${email}`);
}

async function seedProducts() {
  for (let i = 0; i < sourceProducts.length; i++) {
    const data = toProductData(sourceProducts[i], i);
    const existing = await prisma.product.findFirst({ where: { code: data.code } });
    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data });
    } else {
      await prisma.product.create({ data });
    }
  }
  console.log(`Productos sincronizados: ${sourceProducts.length}`);
}

async function main() {
  await seedAdmin();
  await seedProducts();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
