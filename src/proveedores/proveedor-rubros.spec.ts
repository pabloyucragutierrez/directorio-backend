import { normalizarAsignacionesRubro } from './proveedor-rubros';

describe('normalizarAsignacionesRubro', () => {
  it('conserva varios rubros y elimina duplicados equivalentes', () => {
    expect(
      normalizarAsignacionesRubro([
        { rubro: ' Desayunos ', subrubro: 'Canastas' },
        { rubro: 'desayunos', subrubro: ' canastas ' },
        { rubro: 'Comidas', subrubro: 'Restaurante' },
      ]),
    ).toEqual([
      { rubro: 'Desayunos', subrubro: 'Canastas' },
      { rubro: 'Comidas', subrubro: 'Restaurante' },
    ]);
  });

  it('usa los campos legacy cuando no recibe una lista', () => {
    expect(
      normalizarAsignacionesRubro(undefined, {
        rubro: 'Tortas',
        subrubro: 'Pastelería',
        productosComercializa: 'Tortas personalizadas',
      }),
    ).toEqual([
      {
        rubro: 'Tortas',
        subrubro: 'Pastelería',
        productosComercializa: 'Tortas personalizadas',
      },
    ]);
  });
});
