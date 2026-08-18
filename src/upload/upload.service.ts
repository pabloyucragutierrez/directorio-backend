import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class UploadService {
  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'auto' },
        (error, result) => {
          if (error) return reject(error);
          if (!result)
            return reject(new Error('No se obtuvo respuesta de Cloudinary'));
          resolve(result.secure_url);
        },
      );
      Readable.from(file.buffer).pipe(stream);
    });
  }
}
