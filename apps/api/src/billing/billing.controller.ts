import { BadRequestException, Controller, Headers, HttpCode, HttpStatus, Post, Body, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { BillingService } from './billing.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('checkout')
  @RequirePermission('billing:update')
  @ApiOperation({ summary: 'Creează o sesiune Stripe Checkout pentru un plan plătit' })
  createCheckout(@Body() dto: CreateCheckoutDto) {
    return this.billingService.createCheckoutSession(dto);
  }

  @Post('portal')
  @RequirePermission('billing:update')
  @ApiOperation({ summary: 'Creează o sesiune Stripe Billing Portal (gestionare plată/anulare)' })
  createPortal() {
    return this.billingService.createPortalSession();
  }

  /**
   * Apelat direct de serverele Stripe — fără JWT (`@Public()`), fără
   * `@RequirePermission` (nu e nevoie: nu există niciun utilizator la
   * request-ul ăsta). Necesită body-ul RAW (nu JSON parsat) ca să verifice
   * semnătura — vezi `rawBody: true` din `main.ts`.
   */
  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature?: string) {
    if (!req.rawBody || !signature) {
      throw new BadRequestException('Cerere webhook Stripe invalidă — lipsește body-ul sau semnătura.');
    }
    const event = this.billingService.constructEvent(req.rawBody, signature);
    await this.billingService.handleEvent(event);
    return { received: true };
  }
}
