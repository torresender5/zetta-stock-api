import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import Stripe from 'stripe';
import { PrismaService } from 'src/prisma/prisma.service';
import { settlePaymentOrder } from './order-fulfillment';
import {
  PABILO_API_BASE,
  PABILO_LINK_EXPIRATION_MINUTES,
  PABILO_SIGNATURE_HEADER,
  PABILO_SIGNATURE_MAX_AGE_SECONDS,
  PABILO_TIMESTAMP_HEADER,
} from './payment.constant';

export type CheckoutProvider = 'stripe' | 'pabilo';

export interface PaymentAvailability {
  stripe: boolean;
  pabilo: boolean;
}

export interface CheckoutOrder {
  id: number;
  companyId: number;
  planKey: string;
  period: string;
  amount: number;
  concept: string;
  status: string;
}

interface PabiloWebhookEvent {
  payment_link_id?: string;
  status?: string;
  payment_link?: { id?: string; status?: string };
  user_bank_payment?: { id?: string; bank_reference_id?: string } | null;
}

@Injectable()
export class PaymentService {
  private stripeClient: Stripe | null = null;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private prisma: PrismaService,
  ) {}

  // ------------------------------------------------------------------
  // Configuración (las credenciales viven en .env; nunca en el código)
  // ------------------------------------------------------------------

  private get stripeSecretKey(): string | null {
    return process.env.STRIPE_SECRET_KEY?.trim() || null;
  }

  private get stripeWebhookSecret(): string | null {
    return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
  }

  private get pabiloApiKey(): string | null {
    return process.env.PABILO_API_KEY?.trim() || null;
  }

  private get pabiloWebhookSecret(): string | null {
    return process.env.PABILO_WEBHOOK_SECRET?.trim() || null;
  }

  private get pabiloUserBankId(): string | null {
    return process.env.PABILO_USER_BANK_ID?.trim() || null;
  }

  /** URL pública del frontend (retorno del checkout). */
  private get appBaseUrl(): string {
    return (
      process.env.APP_BASE_URL?.trim().replace(/\/+$/, '') ||
      'http://localhost:5173'
    );
  }

  /** URL pública de esta API (webhooks). */
  private get publicApiUrl(): string {
    return (
      process.env.PUBLIC_API_URL?.trim().replace(/\/+$/, '') ||
      'http://localhost:3000'
    );
  }

  private get stripe(): Stripe | null {
    if (!this.stripeSecretKey) return null;
    if (!this.stripeClient) {
      this.stripeClient = new Stripe(this.stripeSecretKey);
    }
    return this.stripeClient;
  }

  /** Métodos de pago activos según la configuración del servidor. */
  availability(): PaymentAvailability {
    return {
      stripe: !!this.stripeSecretKey,
      pabilo: !!(this.pabiloApiKey && this.pabiloUserBankId),
    };
  }

  // ------------------------------------------------------------------
  // Creación de checkout
  // ------------------------------------------------------------------

  async createCheckout(
    order: CheckoutOrder,
    provider: CheckoutProvider,
  ): Promise<{ checkoutUrl: string }> {
    if (provider === 'stripe') {
      return this.createStripeCheckout(order);
    }
    return this.createPabiloLink(order);
  }

  private async createStripeCheckout(
    order: CheckoutOrder,
  ): Promise<{ checkoutUrl: string }> {
    const stripe = this.stripe;
    if (!stripe) {
      throw new BadRequestException('Stripe no está configurado');
    }
    if (order.amount <= 0) {
      throw new BadRequestException('Monto inválido para el cobro');
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: order.amount * 100,
            product_data: { name: order.concept },
          },
          quantity: 1,
        },
      ],
      success_url: `${this.appBaseUrl}/suscripcion?payment=success&orderId=${order.id}`,
      cancel_url: `${this.appBaseUrl}/suscripcion?payment=cancelled`,
      // Divulgación legal junto al botón de confirmación (Fase 2 PLAN_LEGAL.md).
      custom_text: {
        submit: {
          message:
            'Cargo único: no hay renovación automática. Al confirmar aceptas los Términos y Condiciones ' +
            `(${this.appBaseUrl}/terminos) y la Política de Reembolsos (${this.appBaseUrl}/reembolsos).`,
        },
      },
      metadata: { orderId: String(order.id) },
      client_reference_id: String(order.id),
    });

    await this.prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        provider: 'stripe',
        currency: 'USD',
        checkoutUrl: session.url,
        providerRef: session.id,
        expiresAt: session.expires_at
          ? new Date(session.expires_at * 1000)
          : null,
      },
    });

    this.logger.info(
      `Checkout Stripe creado para la orden ${order.id} (empresa ${order.companyId})`,
    );
    return { checkoutUrl: session.url as string };
  }

  private async createPabiloLink(
    order: CheckoutOrder,
  ): Promise<{ checkoutUrl: string }> {
    const apiKey = this.pabiloApiKey;
    const userBankId = this.pabiloUserBankId;
    if (!apiKey || !userBankId) {
      throw new BadRequestException('Pabilo no está configurado');
    }
    if (order.amount <= 0) {
      throw new BadRequestException('Monto inválido para el cobro');
    }

    const response = await fetch(`${PABILO_API_BASE}/v1/paymentlink`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        user_bank_id: userBankId,
        amount: order.amount,
        currency: 'USD',
        description: `${order.concept} · Orden #${order.id}`,
        webhook_url: `${this.publicApiUrl}/webhooks/payments/pabilo`,
        redirect_url: `${this.appBaseUrl}/suscripcion?payment=success&orderId=${order.id}`,
        notification_by_whastapp: false,
        expiration_time: PABILO_LINK_EXPIRATION_MINUTES,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.error(`Pabilo respondió ${response.status}: ${detail}`);
      throw new BadRequestException(
        'No se pudo crear el link de pago de Pabilo',
      );
    }

    const payload = (await response.json()) as {
      paymentlink?: { id?: string; url?: string };
    };
    const link = payload.paymentlink;
    if (!link?.url) {
      this.logger.error('Respuesta inesperada de Pabilo: sin paymentlink.url');
      throw new BadRequestException('Respuesta inválida de Pabilo');
    }

    await this.prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        provider: 'pabilo',
        currency: 'USD',
        checkoutUrl: link.url,
        providerRef: link.id ?? null,
        expiresAt: new Date(
          Date.now() + PABILO_LINK_EXPIRATION_MINUTES * 60000,
        ),
      },
    });

    this.logger.info(
      `Link Pabilo creado para la orden ${order.id} (empresa ${order.companyId})`,
    );
    return { checkoutUrl: link.url };
  }

  // ------------------------------------------------------------------
  // Webhooks
  // ------------------------------------------------------------------

  /** Verifica la firma de Stripe y liquida la orden si el pago se completó. */
  async handleStripeWebhook(
    rawBody: Buffer | string,
    signature: string,
  ): Promise<{ received: boolean }> {
    const stripe = this.stripe;
    const secret = this.stripeWebhookSecret;
    if (!stripe || !secret) {
      throw new BadRequestException('Webhook de Stripe no configurado');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      this.logger.warn('Firma inválida en webhook de Stripe');
      throw new BadRequestException('Firma del webhook inválida');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.payment_status !== 'paid') {
        return { received: true };
      }
      const orderId = Number(
        session.metadata?.orderId ?? session.client_reference_id,
      );
      if (Number.isInteger(orderId) && orderId > 0) {
        await this.settleOrder(orderId, `stripe:${session.id}`);
      }
    }
    return { received: true };
  }

  /** Verifica la firma HMAC de Pabilo y liquida la orden correspondiente. */
  async handlePabiloWebhook(
    rawBody: Buffer,
    headers: Record<string, string | undefined>,
  ): Promise<{ received: boolean }> {
    if (!this.verifyPabiloSignature(rawBody, headers)) {
      this.logger.warn('Firma inválida en webhook de Pabilo');
      throw new UnauthorizedException('Firma del webhook inválida');
    }

    let event: PabiloWebhookEvent;
    try {
      event = JSON.parse(rawBody.toString('utf8')) as PabiloWebhookEvent;
    } catch {
      throw new BadRequestException('Payload inválido');
    }

    const linkId = event.payment_link_id ?? event.payment_link?.id;
    if (!linkId) {
      return { received: true };
    }

    const order = await this.prisma.paymentOrder.findFirst({
      where: { providerRef: linkId, provider: 'pabilo' },
    });
    if (!order) {
      this.logger.warn(`Webhook de Pabilo para link desconocido: ${linkId}`);
      return { received: true };
    }

    if (event.status === 'paid') {
      const reference =
        event.user_bank_payment?.bank_reference_id ??
        event.user_bank_payment?.id ??
        linkId;
      await this.settleOrder(order.id, `pabilo:${reference}`);
    } else if (event.status === 'failed') {
      await this.prisma.paymentOrder.updateMany({
        where: { id: order.id, status: 'pending' },
        data: { status: 'rejected' },
      });
      this.logger.info(`Pago Pabilo fallido para la orden ${order.id}`);
    }
    return { received: true };
  }

  /**
   * Marca la orden como pagada y activa la suscripción. Idempotente: si la
   * orden ya no está pendiente no hace nada (reintentos de los webhooks).
   */
  private async settleOrder(
    orderId: number,
    reference: string,
  ): Promise<boolean> {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      this.logger.warn(`Webhook referenció una orden inexistente: ${orderId}`);
      return false;
    }
    if (order.status !== 'pending') {
      this.logger.info(
        `Webhook ${reference}: orden ${orderId} ya procesada (${order.status})`,
      );
      return false;
    }
    await settlePaymentOrder(this.prisma, order);
    this.logger.info(
      `Pago confirmado por webhook ${reference}: orden ${orderId}, empresa ${order.companyId}`,
    );
    return true;
  }

  /**
   * Firma HMAC-SHA256 de Pabilo: HMAC(secret, `${timestamp}.${body}`) en hex,
   * comparada en tiempo constante con `X-Pabilo-Signature: sha256=<hex>`.
   */
  private verifyPabiloSignature(
    rawBody: Buffer,
    headers: Record<string, string | undefined>,
  ): boolean {
    const secret = this.pabiloWebhookSecret;
    if (!secret) return false;

    const timestamp = headers[PABILO_TIMESTAMP_HEADER];
    const signature = headers[PABILO_SIGNATURE_HEADER];
    if (!timestamp || !/^\d+$/.test(timestamp)) return false;
    if (!signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;

    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (age > PABILO_SIGNATURE_MAX_AGE_SECONDS) return false;

    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.`)
      .update(rawBody)
      .digest();
    const received = Buffer.from(signature.slice(7), 'hex');
    if (received.length !== expected.length) return false;
    return timingSafeEqual(received, expected);
  }
}
