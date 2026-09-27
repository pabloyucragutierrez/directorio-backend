import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { contactKeys, parseBatch } from './import-proveedores';

describe('importador de proveedores', () => {
  it('no modifica la base si no recibe un lote', () => {
    const script = path.resolve(__dirname, 'import-proveedores.ts');
    const output = execFileSync(
      process.execPath,
      ['-r', 'ts-node/register', script],
      {
        env: {
          ...process.env,
          DATABASE_URL: 'postgresql://user:pass@localhost:5432/directorio',
          SUPPLIER_IMPORT_BATCH_JSON: '',
        },
        encoding: 'utf8',
      },
    );

    expect(output).toContain('IMPORT_RESULT []');
  });

  it('acepta un proveedor con un solo medio de contacto', () => {
    const [proveedor] = parseBatch(
      JSON.stringify([
        {
          razonSocial: 'Proveedor de prueba',
          pais: 'Perú',
          ciudad: 'Lima',
          rubro: 'Comidas',
          subrubro: 'Restaurante',
          productosComercializa: 'Comida peruana',
          telefono: '+51 999 888 777',
          fuenteVerificacion: 'https://example.com/proveedor',
        },
      ]),
    );

    expect(proveedor.telefono).toBe('+51 999 888 777');
    expect(proveedor.whatsapp).toBeUndefined();
    expect(proveedor.email).toBeUndefined();
    expect(proveedor.personaContacto).toBeUndefined();
  });

  it('rechaza un proveedor sin teléfono, WhatsApp ni email', () => {
    expect(() =>
      parseBatch(
        JSON.stringify([
          {
            razonSocial: 'Proveedor sin contacto',
            pais: 'Perú',
            ciudad: 'Lima',
            rubro: 'Comidas',
            subrubro: 'Restaurante',
            productosComercializa: 'Comida peruana',
            fuenteVerificacion: 'https://example.com/proveedor',
          },
        ]),
      ),
    ).toThrow('se requiere teléfono, WhatsApp o email');
  });

  it('normaliza y separa los contactos por país', () => {
    expect(contactKeys('+51 999 888 777', 'PE')).toEqual(['PE:999888777']);
    expect(contactKeys('+56 9 6363 6189', 'CL')).toEqual(['CL:963636189']);
    expect(contactKeys('+57 300 123 4567', 'CO')).toEqual(['CO:3001234567']);
    expect(contactKeys('300 123 4567', 'PE')).toEqual(['PE:3001234567']);
    expect(contactKeys('300 123 4567', 'CO')).toEqual(['CO:3001234567']);
  });
});
