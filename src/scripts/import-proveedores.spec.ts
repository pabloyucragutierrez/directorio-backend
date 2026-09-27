import { execFileSync } from 'node:child_process';
import path from 'node:path';

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
});
