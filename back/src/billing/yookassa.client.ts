import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

export type YooKassaPayment = {
  id: string;
  status: string;
  amount: { value: string; currency: string };
  confirmation?: { type: string; confirmation_url?: string };
  metadata?: Record<string, string>;
  paid?: boolean;
};

@Injectable()
export class YooKassaClient {
  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(this.shopId() && this.secretKey());
  }

  async createRedirectPayment(input: {
    amountRub: number;
    description: string;
    returnUrl: string;
    metadata: Record<string, string>;
  }): Promise<YooKassaPayment> {
    const { data } = await this.http().post<YooKassaPayment>(
      '/payments',
      {
        amount: {
          value: input.amountRub.toFixed(2),
          currency: 'RUB',
        },
        capture: true,
        confirmation: {
          type: 'redirect',
          return_url: input.returnUrl,
        },
        description: input.description,
        metadata: input.metadata,
      },
      {
        headers: { 'Idempotence-Key': crypto.randomUUID() },
      },
    );
    return data;
  }

  async getPayment(id: string): Promise<YooKassaPayment> {
    const { data } = await this.http().get<YooKassaPayment>(
      `/payments/${encodeURIComponent(id)}`,
    );
    return data;
  }

  private shopId() {
    return String(this.config.get('YOOKASSA_SHOP_ID') ?? '').trim();
  }

  private secretKey() {
    return String(this.config.get('YOOKASSA_SECRET_KEY') ?? '').trim();
  }

  private http(): AxiosInstance {
    const shopId = this.shopId();
    const secret = this.secretKey();
    if (!shopId || !secret) {
      throw new Error('YooKassa is not configured');
    }
    return axios.create({
      baseURL: 'https://api.yookassa.ru/v3',
      auth: { username: shopId, password: secret },
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });
  }
}
