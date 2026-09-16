import { Inject, Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class R2Service {
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;

    if (
      !accountId ||
      !accessKeyId ||
      !secretAccessKey ||
      !bucket ||
      !publicUrl
    ) {
      throw new Error(
        'Cloudflare R2 configuration is missing. Check R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME and R2_PUBLIC_URL env variables.',
      );
    }

    this.bucket = bucket;
    this.publicUrl = publicUrl.replace(/\/+$/, '');

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  async uploadFile(folder: string, file: Express.Multer.File): Promise<string> {
    const key = `${folder}/${uuidv4()}${extname(file.originalname)}`;
    this.logger.info(`Uploading file to R2: ${key}`);
    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
      this.logger.info(`File uploaded to R2: ${key}`);
      return `${this.publicUrl}/${key}`;
    } catch (error) {
      this.logger.error('Error uploading file to R2:', error);
      throw error;
    }
  }

  async deleteFile(url: string): Promise<void> {
    const publicPrefix = `${this.publicUrl}/`;
    if (!url || !url.startsWith(publicPrefix)) {
      return;
    }
    const key = url.replace(publicPrefix, '');
    this.logger.info(`Deleting file from R2: ${key}`);
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      this.logger.info(`File deleted from R2: ${key}`);
    } catch (error) {
      this.logger.error(`Error deleting file from R2: ${key}`, error);
    }
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }
}
