import { formarCodigoProveedor, resolverCodigoPais } from './codigo-proveedor';

describe('codificación de proveedores', () => {
  it.each([
    ['Perú', 'PE'],
    ['Peru', 'PE'],
    ['PE', 'PE'],
    ['Estados Unidos', 'US'],
    ['USA', 'US'],
    ['España', 'ES'],
  ])('resuelve %s como %s', (pais, esperado) => {
    expect(resolverCodigoPais(pais)).toBe(esperado);
  });

  it('devuelve null para un país desconocido', () => {
    expect(resolverCodigoPais('País inexistente')).toBeNull();
  });

  it('forma un código alfanumérico de exactamente 10 caracteres', () => {
    expect(formarCodigoProveedor('pe', 1)).toBe('PE00000001');
    expect(formarCodigoProveedor('PE', 99_999_999)).toBe('PE99999999');
  });

  it.each([0, -1, 100_000_000, 1.5])(
    'rechaza el correlativo inválido %s',
    (correlativo) => {
      expect(() => formarCodigoProveedor('PE', correlativo)).toThrow();
    },
  );
});
