import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './config/winston.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove properties not defined in the DTO
      transform: true, // Automatically transform plain objects to DTO instances
      forbidNonWhitelisted: true, // Throw an error if non-whitelisted properties are present
    }),
  );

  const corsOrigins = (
    process.env.CORS_ORIGINS ??
    'https://app.zettastock.com,https://zettastock.com,http://localhost:5173'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins, // Orígenes permitidos del frontend (env CORS_ORIGINS)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS', // Allowed HTTP methods
    credentials: true, // Allow sending cookies and authorization headers
  });

  // await app.listen(3000); // Or
  // Use DocumentBuilder to create a new Swagger document configuration
  const config = new DocumentBuilder()
    .setTitle('zettastock API') // Set the title of the API
    .setDescription('Api Nestjs') // Set the description of the API
    .setVersion('0.1') // Set the version of the API
    .addBearerAuth() // JWT auth
    .addBasicAuth() // Basic auth (UserAdmin)
    .build(); // Build the document

  // Create a Swagger document using the application instance and the document configuration
  const document = SwaggerModule.createDocument(app, config);

  // Setup Swagger module with the application instance and the Swagger document
  SwaggerModule.setup('swagger', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
