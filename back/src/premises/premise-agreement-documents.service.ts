import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import { join } from 'node:path';
import { FileStorageService } from '../files/file-storage.service';
import { LocalFileStorageService } from '../files/local-file-storage.service';

type AgreementPdfParams = {
  agreementNumber: string;
  premiseName: string;
  premiseAddress: string | null;
  landlordName: string;
  landlordDetails: string | null;
  tenantName: string;
  tenantDetails: string | null;
  title: string;
  startsOn: Date;
  endsOn: Date | null;
  recurrenceLabel: string;
  scheduleLines: string[];
  amountLabel: string | null;
  paymentDueDay: number | null;
};

@Injectable()
export class PremiseAgreementDocumentsService {
  constructor(
    private readonly config: ConfigService,
    private readonly storage: FileStorageService,
    private readonly localStorage: LocalFileStorageService,
  ) {}

  async generatePdf(params: AgreementPdfParams): Promise<Buffer> {
    const document = new PDFDocument({
      size: 'A4',
      margins: { top: 48, right: 48, bottom: 48, left: 48 },
      info: {
        Title: `Договор аренды ${params.agreementNumber}`,
        Author: 'Orchestra',
      },
    });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    const completed = new Promise<Buffer>((resolve, reject) => {
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);
    });
    const fontPath = join(
      process.cwd(),
      'node_modules',
      '@fontsource',
      'roboto',
      'files',
      'roboto-cyrillic-400-normal.woff',
    );
    document.font(fontPath);

    document
      .fontSize(16)
      .text(`ДОГОВОР АРЕНДЫ ПОМЕЩЕНИЯ № ${params.agreementNumber}`, {
        align: 'center',
      });
    document.moveDown();
    document
      .fontSize(10)
      .text(
        `${params.landlordName}, далее «Арендодатель», и ${params.tenantName}, далее «Арендатор», договорились о нижеследующем.`,
      );
    document.moveDown();
    document.fontSize(12).text('1. Предмет договора');
    document
      .fontSize(10)
      .text(`Помещение: ${params.premiseName}`)
      .text(`Адрес: ${params.premiseAddress || 'не указан'}`)
      .text(`Цель использования: ${params.title}`)
      .text(`Периодичность: ${params.recurrenceLabel}`)
      .text(
        `Период: ${this.formatDate(params.startsOn)} — ${
          params.endsOn
            ? this.formatDate(params.endsOn)
            : params.recurrenceLabel.includes('бессрочная')
              ? 'бессрочно'
              : 'однократно'
        }`,
      );
    params.scheduleLines.forEach((line) => document.text(line));

    document.moveDown();
    document.fontSize(12).text('2. Стоимость и расчёты');
    document
      .fontSize(10)
      .text(
        params.amountLabel
          ? `Стоимость: ${params.amountLabel}.`
          : 'Использование помещения осуществляется без оплаты.',
      );
    if (params.paymentDueDay) {
      document.text(
        `Ежемесячная оплата производится до ${params.paymentDueDay}-го числа.`,
      );
    }

    document.moveDown();
    document.fontSize(12).text('3. Реквизиты сторон');
    document
      .fontSize(10)
      .text(`Арендодатель: ${params.landlordName}`)
      .text(params.landlordDetails || 'Реквизиты не указаны')
      .moveDown(0.5)
      .text(`Арендатор: ${params.tenantName}`)
      .text(params.tenantDetails || 'Реквизиты не указаны');

    document.moveDown(2);
    document
      .text('Арендодатель: ____________________')
      .moveDown()
      .text('Арендатор: _______________________');
    document.end();
    return completed;
  }

  async storePdf(params: {
    agreementId: string;
    kind: 'generated' | 'uploaded' | 'signed';
    fileName: string;
    buffer: Buffer;
  }) {
    const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const key = `premise-agreements/${params.agreementId}/${params.kind}-${Date.now()}-${safeName}`;
    const storage = this.useLocalStorage() ? this.localStorage : this.storage;
    return storage.uploadObjectAtKey({
      key,
      buffer: params.buffer,
      contentType: 'application/pdf',
    });
  }

  async getObjectStream(key: string) {
    if (this.useLocalStorage()) {
      return {
        localPath: this.localStorage.pathForKey(key),
      };
    }
    return this.storage.getObjectStream(key);
  }

  private useLocalStorage(): boolean {
    return this.config.get<string>('STORAGE_TYPE') === 'local';
  }

  private formatDate(value: Date): string {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(value);
  }
}
