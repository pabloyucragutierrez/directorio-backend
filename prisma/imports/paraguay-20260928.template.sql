-- Carga idempotente de proveedores captados en Paraguay.
-- Reglas: código único PY########, ocho rubros oficiales, subrubros separados,
-- un proveedor principal con múltiples asociaciones y estado VE sólo con contacto.
DO $paraguay_import$
DECLARE
  run_id CONSTANT TEXT := 'paraguay-20260928-v1';
  payload JSONB := $paraguay_payload$__PARAGUAY_PAYLOAD_JSON__$paraguay_payload$::jsonb;
  candidate JSONB;
  relation JSONB;
  evidence JSONB;
  relation_evidence JSONB;
  matched_ids INTEGER[];
  provider_id INTEGER;
  existing_code TEXT;
  existing_status TEXT;
  existing_phone TEXT;
  existing_whatsapp TEXT;
  existing_email TEXT;
  candidate_name_key TEXT;
  next_number INTEGER;
  candidate_status VARCHAR(2);
  has_contact BOOLEAN;
  created_count INTEGER := 0;
  updated_count INTEGER := 0;
  conflict_count INTEGER := 0;
  relation_count INTEGER := 0;
  verified_count INTEGER := 0;
  unverified_count INTEGER := 0;
  conflicts JSONB := '[]'::jsonb;
BEGIN
  CREATE TABLE IF NOT EXISTS "CargaProveedorAuditoria" (
    "runId" TEXT PRIMARY KEY,
    "pais" TEXT NOT NULL,
    "filasFuente" INTEGER NOT NULL,
    "proveedoresPayload" INTEGER NOT NULL,
    "creados" INTEGER NOT NULL DEFAULT 0,
    "actualizados" INTEGER NOT NULL DEFAULT 0,
    "conflictosOmitidos" INTEGER NOT NULL DEFAULT 0,
    "relacionesProcesadas" INTEGER NOT NULL DEFAULT 0,
    "verificados" INTEGER NOT NULL DEFAULT 0,
    "noVerificados" INTEGER NOT NULL DEFAULT 0,
    "detalle" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  LOCK TABLE "Proveedor" IN SHARE ROW EXCLUSIVE MODE;

  CREATE TEMP TABLE "ParaguayProveedorCoincidencia"
  ON COMMIT DROP
  AS
  SELECT
    regexp_replace(
      translate(lower(trim(p."razonSocial")), 'áéíóúüñãõç', 'aeiouunaoc'),
      '[^a-z0-9]+',
      '',
      'g'
    ) AS "nameKey",
    array_agg(p."id" ORDER BY p."id") AS "ids"
  FROM "Proveedor" p
  WHERE (
    p."codigoPais" = 'PY'
    OR p."codigoProveedor" LIKE 'PY%'
    OR translate(lower(trim(p."pais")), 'áéíóúüñãõç', 'aeiouunaoc') = 'paraguay'
  )
  GROUP BY 1;

  CREATE UNIQUE INDEX "ParaguayProveedorCoincidencia_nameKey_key"
  ON "ParaguayProveedorCoincidencia" ("nameKey");

  INSERT INTO "CargaProveedorAuditoria" (
    "runId", "pais", "filasFuente", "proveedoresPayload", "detalle", "createdAt", "updatedAt"
  ) VALUES (
    run_id, 'Paraguay', 1364, jsonb_array_length(payload),
    jsonb_build_object('estado', 'INICIADO'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
  ON CONFLICT ("runId") DO UPDATE SET
    "filasFuente" = EXCLUDED."filasFuente",
    "proveedoresPayload" = EXCLUDED."proveedoresPayload",
    "detalle" = EXCLUDED."detalle",
    "updatedAt" = CURRENT_TIMESTAMP;

  INSERT INTO "SecuenciaProveedorPais" (
    "codigoPais", "ultimoNumero", "createdAt", "updatedAt"
  )
  SELECT
    'PY',
    COALESCE(MAX(substring("codigoProveedor" from 3)::integer), 0),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM "Proveedor"
  WHERE "codigoProveedor" ~ '^PY[0-9]{8}$'
  ON CONFLICT ("codigoPais") DO UPDATE SET
    "ultimoNumero" = GREATEST(
      "SecuenciaProveedorPais"."ultimoNumero",
      EXCLUDED."ultimoNumero"
    ),
    "updatedAt" = CURRENT_TIMESTAMP;

  SELECT "ultimoNumero"
  INTO next_number
  FROM "SecuenciaProveedorPais"
  WHERE "codigoPais" = 'PY'
  FOR UPDATE;

  FOR candidate IN
    SELECT value FROM jsonb_array_elements(payload)
  LOOP
    candidate_name_key := regexp_replace(
      translate(
        lower(trim(candidate->>'razonSocial')),
        'áéíóúüñãõç',
        'aeiouunaoc'
      ),
      '[^a-z0-9]+',
      '',
      'g'
    );

    SELECT existing."ids"
    INTO matched_ids
    FROM "ParaguayProveedorCoincidencia" existing
    WHERE existing."nameKey" = candidate_name_key;

    IF COALESCE(cardinality(matched_ids), 0) > 1 THEN
      conflict_count := conflict_count + 1;
      IF jsonb_array_length(conflicts) < 100 THEN
        conflicts := conflicts || jsonb_build_array(jsonb_build_object(
          'razonSocial', candidate->>'razonSocial',
          'motivo', 'multiples-coincidencias-exactas',
          'ids', to_jsonb(matched_ids)
        ));
      END IF;
      CONTINUE;
    END IF;

    has_contact := COALESCE(NULLIF(trim(candidate->>'telefono'), ''), '') <> ''
      OR COALESCE(NULLIF(trim(candidate->>'whatsapp'), ''), '') <> ''
      OR COALESCE(NULLIF(trim(candidate->>'email'), ''), '') <> '';

    IF COALESCE(cardinality(matched_ids), 0) = 1 THEN
      provider_id := matched_ids[1];
      SELECT
        "codigoProveedor", "estadoVerificacion", "telefono", "whatsapp", "email"
      INTO
        existing_code, existing_status, existing_phone, existing_whatsapp, existing_email
      FROM "Proveedor"
      WHERE "id" = provider_id
      FOR UPDATE;

      IF existing_code IS NOT NULL AND existing_code !~ '^PY[0-9]{8}$' THEN
        conflict_count := conflict_count + 1;
        IF jsonb_array_length(conflicts) < 100 THEN
          conflicts := conflicts || jsonb_build_array(jsonb_build_object(
            'razonSocial', candidate->>'razonSocial',
            'motivo', 'codigo-existente-incompatible',
            'id', provider_id,
            'codigo', existing_code
          ));
        END IF;
        CONTINUE;
      END IF;

      IF existing_code IS NULL THEN
        next_number := next_number + 1;
        existing_code := 'PY' || lpad(next_number::text, 8, '0');
      END IF;

      has_contact := has_contact
        OR COALESCE(NULLIF(trim(existing_phone), ''), '') <> ''
        OR COALESCE(NULLIF(trim(existing_whatsapp), ''), '') <> ''
        OR COALESCE(NULLIF(trim(existing_email), ''), '') <> '';
      candidate_status := CASE
        WHEN existing_status = 'VE' OR has_contact THEN 'VE'
        ELSE 'NV'
      END;

      evidence := jsonb_build_object(
        'origen', 'Carga verificada Paraguay 2026-09-28',
        'runId', run_id,
        'archivoFuente', candidate->>'sourceFile',
        'filaFuente', (candidate->>'sourceRow')::integer,
        'registrosFuente', candidate->'sourceRecords',
        'estadoCaptacion', candidate->>'sourceStatus',
        'fuentePrincipal', candidate->>'fuenteVerificacion',
        'criterios', jsonb_build_object(
          'nombreComercial', true,
          'ubicacionPais', true,
          'rubroSubrubro', true,
          'productosServicios', true,
          'fuentePublica', true,
          'contacto', has_contact,
          'duplicidadRevisada', true
        ),
        'resultado', candidate_status,
        'revisionDuplicidad', jsonb_build_object(
          'resultado', 'actualizacion de coincidencia exacta existente',
          'metodo', 'pais-y-nombre-normalizado',
          'proveedorId', provider_id
        )
      );

      UPDATE "Proveedor"
      SET
        "codigoProveedor" = existing_code,
        "codigoPais" = 'PY',
        "pais" = 'Paraguay',
        "ciudad" = COALESCE(NULLIF(trim("ciudad"), ''), candidate->>'ciudad', 'Paraguay'),
        "direccion" = COALESCE(NULLIF(trim("direccion"), ''), NULLIF(candidate->>'direccion', '')),
        "rubro" = candidate->>'rubro',
        "subrubro" = candidate->>'subrubro',
        "productosComercializa" = candidate->>'productosComercializa',
        "personaContacto" = COALESCE(NULLIF(trim("personaContacto"), ''), NULLIF(candidate->>'personaContacto', '')),
        "website" = COALESCE(NULLIF(trim("website"), ''), NULLIF(candidate->>'website', '')),
        "redesSociales" = COALESCE(NULLIF(trim("redesSociales"), ''), NULLIF(candidate->>'redesSociales', '')),
        "comentarios" = CASE
          WHEN NULLIF(trim("comentarios"), '') IS NULL THEN NULLIF(candidate->>'comentarios', '')
          WHEN NULLIF(candidate->>'comentarios', '') IS NULL THEN "comentarios"
          WHEN position((candidate->>'comentarios') in "comentarios") > 0 THEN "comentarios"
          ELSE "comentarios" || ' | ' || (candidate->>'comentarios')
        END,
        "telefono" = COALESCE(NULLIF(trim("telefono"), ''), NULLIF(candidate->>'telefono', '')),
        "whatsapp" = COALESCE(NULLIF(trim("whatsapp"), ''), NULLIF(candidate->>'whatsapp', '')),
        "email" = COALESCE(NULLIF(trim("email"), ''), NULLIF(candidate->>'email', '')),
        "estadoVerificacion" = candidate_status,
        "fechaVerificacion" = CASE
          WHEN candidate_status = 'VE' THEN COALESCE("fechaVerificacion", CURRENT_TIMESTAMP)
          ELSE NULL
        END,
        "fuenteVerificacion" = candidate->>'fuenteVerificacion',
        "fechaDiscovery" = COALESCE(
          "fechaDiscovery",
          NULLIF(candidate->>'fechaDiscovery', '')::date
        ),
        "evidenciaVerificacion" = evidence,
        "activo" = true,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = provider_id;

      updated_count := updated_count + 1;
    ELSE
      next_number := next_number + 1;
      existing_code := 'PY' || lpad(next_number::text, 8, '0');
      candidate_status := CASE WHEN has_contact THEN 'VE' ELSE 'NV' END;

      evidence := jsonb_build_object(
        'origen', 'Carga verificada Paraguay 2026-09-28',
        'runId', run_id,
        'archivoFuente', candidate->>'sourceFile',
        'filaFuente', (candidate->>'sourceRow')::integer,
        'registrosFuente', candidate->'sourceRecords',
        'estadoCaptacion', candidate->>'sourceStatus',
        'fuentePrincipal', candidate->>'fuenteVerificacion',
        'criterios', jsonb_build_object(
          'nombreComercial', true,
          'ubicacionPais', true,
          'rubroSubrubro', true,
          'productosServicios', true,
          'fuentePublica', true,
          'contacto', has_contact,
          'duplicidadRevisada', true
        ),
        'resultado', candidate_status,
        'revisionDuplicidad', jsonb_build_object(
          'resultado', 'sin coincidencia exacta; codigo nuevo',
          'metodo', 'pais-y-nombre-normalizado'
        )
      );

      INSERT INTO "Proveedor" (
        "codigoProveedor", "codigoPais", "razonSocial", "pais", "ciudad",
        "direccion", "rubro", "subrubro", "productosComercializa",
        "personaContacto", "website", "redesSociales", "comentarios",
        "email", "telefono", "whatsapp", "estadoVerificacion",
        "fechaVerificacion", "fuenteVerificacion", "fechaDiscovery",
        "evidenciaVerificacion", "activo", "createdAt", "updatedAt"
      ) VALUES (
        existing_code,
        'PY',
        candidate->>'razonSocial',
        'Paraguay',
        COALESCE(NULLIF(candidate->>'ciudad', ''), 'Paraguay'),
        NULLIF(candidate->>'direccion', ''),
        candidate->>'rubro',
        candidate->>'subrubro',
        candidate->>'productosComercializa',
        NULLIF(candidate->>'personaContacto', ''),
        NULLIF(candidate->>'website', ''),
        NULLIF(candidate->>'redesSociales', ''),
        NULLIF(candidate->>'comentarios', ''),
        NULLIF(candidate->>'email', ''),
        NULLIF(candidate->>'telefono', ''),
        NULLIF(candidate->>'whatsapp', ''),
        candidate_status,
        CASE WHEN candidate_status = 'VE' THEN CURRENT_TIMESTAMP ELSE NULL END,
        candidate->>'fuenteVerificacion',
        NULLIF(candidate->>'fechaDiscovery', '')::date,
        evidence,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      RETURNING "id" INTO provider_id;

      created_count := created_count + 1;
    END IF;

    UPDATE "ProveedorRubro"
    SET "esPrincipal" = false, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "proveedorId" = provider_id AND "esPrincipal" = true;

    FOR relation IN
      SELECT value FROM jsonb_array_elements(candidate->'associations')
    LOOP
      relation_evidence := jsonb_build_object(
        'origen', 'Carga verificada Paraguay 2026-09-28',
        'runId', run_id,
        'archivoFuente', relation->>'sourceFile',
        'filaFuente', (relation->>'sourceRow')::integer,
        'fuentePrincipal', relation->>'fuenteVerificacion',
        'rubro', relation->>'rubro',
        'subrubro', relation->>'subrubro'
      );

      INSERT INTO "ProveedorRubro" (
        "proveedorId", "rubro", "subrubro", "productosComercializa",
        "fuenteVerificacion", "evidenciaVerificacion", "esPrincipal",
        "createdAt", "updatedAt"
      ) VALUES (
        provider_id,
        relation->>'rubro',
        relation->>'subrubro',
        NULLIF(relation->>'productosComercializa', ''),
        NULLIF(relation->>'fuenteVerificacion', ''),
        relation_evidence,
        COALESCE((relation->>'esPrincipal')::boolean, false),
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("proveedorId", "rubro", "subrubro") DO UPDATE SET
        "productosComercializa" = EXCLUDED."productosComercializa",
        "fuenteVerificacion" = EXCLUDED."fuenteVerificacion",
        "evidenciaVerificacion" = EXCLUDED."evidenciaVerificacion",
        "esPrincipal" = EXCLUDED."esPrincipal",
        "updatedAt" = CURRENT_TIMESTAMP;

      relation_count := relation_count + 1;
    END LOOP;

    IF candidate_status = 'VE' THEN
      verified_count := verified_count + 1;
    ELSE
      unverified_count := unverified_count + 1;
    END IF;
  END LOOP;

  UPDATE "SecuenciaProveedorPais"
  SET "ultimoNumero" = next_number, "updatedAt" = CURRENT_TIMESTAMP
  WHERE "codigoPais" = 'PY';

  UPDATE "CargaProveedorAuditoria"
  SET
    "creados" = created_count,
    "actualizados" = updated_count,
    "conflictosOmitidos" = conflict_count,
    "relacionesProcesadas" = relation_count,
    "verificados" = verified_count,
    "noVerificados" = unverified_count,
    "detalle" = jsonb_build_object(
      'estado', 'COMPLETADO',
      'conflictos', conflicts,
      'reglas', jsonb_build_object(
        'codigo', 'PY########',
        'unProveedorUnCodigo', true,
        'multirubro', true,
        'rubroSubrubroSeparados', true,
        'verificadoRequiereContacto', true
      )
    ),
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "runId" = run_id;

  RAISE NOTICE 'PARAGUAY_IMPORT_RESULT %', jsonb_build_object(
    'payload', jsonb_array_length(payload),
    'creados', created_count,
    'actualizados', updated_count,
    'conflictos', conflict_count,
    'relaciones', relation_count,
    'VE', verified_count,
    'NV', unverified_count,
    'ultimoCodigo', 'PY' || lpad(next_number::text, 8, '0')
  );
END
$paraguay_import$;
