import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({ origin: '*' });

  const config = new DocumentBuilder()
    .setTitle('Directorio de Proveedores API')
    .setDescription('API para gestión de proveedores y pedidos')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // 🔥 CLAVE PARA RAILWAY
  const port = process.env.PORT || 3001;

  await app.listen(port, '0.0.0.0');

  console.log(`Backend corriendo en http://localhost:${port}`);
  console.log(`Swagger en http://localhost:${port}/api`);
}
bootstrap();
