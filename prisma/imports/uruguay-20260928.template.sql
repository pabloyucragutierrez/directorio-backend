-- Carga idempotente y auditada de proveedores captados en Uruguay.
-- Reglas: UY########, ocho rubros oficiales, subrubros separados,
-- un proveedor con múltiples asociaciones y VE sólo con contacto y duplicidad resuelta.
DO $uruguay_import$
DECLARE
  run_id CONSTANT TEXT := 'uruguay-20260928-v1';
  payload JSONB := $uruguay_payload$__URUGUAY_PAYLOAD_JSON__$uruguay_payload$::jsonb;
  candidate JSONB;
  relation JSONB;
  evidence JSONB;
  relation_evidence JSONB;
  matched_ids INTEGER[];
  provider_id INTEGER;
  existing_code TEXT;
  candidate_name_key TEXT;
  candidate_location_key TEXT;
  candidate_address_key TEXT;
  candidate_import_key TEXT;
  candidate_status VARCHAR(2);
  duplicate_review TEXT;
  has_contact BOOLEAN;
  next_number INTEGER;
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

  CREATE TEMP TABLE "UruguayProveedorCoincidencia"
  ON COMMIT DROP
  AS
  SELECT
    p."id",
    p."evidenciaVerificacion"->>'importKey' AS "importKey",
    regexp_replace(
      translate(lower(trim(p."razonSocial")), 'áéíóúüñãõç', 'aeiouunaoc'),
      '[^a-z0-9]+', '', 'g'
    ) AS "nameKey",
    regexp_replace(
      translate(lower(trim(p."ciudad")), 'áéíóúüñãõç', 'aeiouunaoc'),
      '[^a-z0-9]+', '', 'g'
    ) AS "locationKey",
    regexp_replace(
      translate(lower(trim(COALESCE(p."direccion", ''))), 'áéíóúüñãõç', 'aeiouunaoc'),
      '[^a-z0-9]+', '', 'g'
    ) AS "addressKey"
  FROM "Proveedor" p
  WHERE (
    p."codigoPais" = 'UY'
    OR p."codigoProveedor" LIKE 'UY%'
    OR translate(lower(trim(p."pais")), 'áéíóúüñãõç', 'aeiouunaoc') = 'uruguay'
  );

  CREATE INDEX "UruguayProveedorCoincidencia_importKey_idx"
  ON "UruguayProveedorCoincidencia" ("importKey");
  CREATE INDEX "UruguayProveedorCoincidencia_nameLocation_idx"
  ON "UruguayProveedorCoincidencia" ("nameKey", "locationKey");
  CREATE INDEX "UruguayProveedorCoincidencia_nameAddress_idx"
  ON "UruguayProveedorCoincidencia" ("nameKey", "addressKey");

  INSERT INTO "CargaProveedorAuditoria" (
    "runId", "pais", "filasFuente", "proveedoresPayload", "detalle", "createdAt", "updatedAt"
  ) VALUES (
    run_id, 'Uruguay', 2550, jsonb_array_length(payload),
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
    'UY',
    COALESCE(MAX(substring("codigoProveedor" from 3)::integer), 0),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM "Proveedor"
  WHERE "codigoProveedor" ~ '^UY[0-9]{8}$'
  ON CONFLICT ("codigoPais") DO UPDATE SET
    "ultimoNumero" = GREATEST("SecuenciaProveedorPais"."ultimoNumero", EXCLUDED."ultimoNumero"),
    "updatedAt" = CURRENT_TIMESTAMP;

  SELECT "ultimoNumero" INTO next_number
  FROM "SecuenciaProveedorPais"
  WHERE "codigoPais" = 'UY'
  FOR UPDATE;

  FOR candidate IN SELECT value FROM jsonb_array_elements(payload)
  LOOP
    candidate_name_key := candidate->>'nameKey';
    candidate_location_key := candidate->>'locationKey';
    candidate_address_key := regexp_replace(
      translate(lower(trim(COALESCE(candidate->>'direccion', ''))), 'áéíóúüñãõç', 'aeiouunaoc'),
      '[^a-z0-9]+', '', 'g'
    );
    candidate_import_key := candidate_name_key || ':' || candidate_location_key || ':'
      || (candidate->>'sourceFile') || ':' || (candidate->>'sourceRow');
    duplicate_review := candidate->>'duplicateReview';
    candidate_status := (candidate->>'estadoVerificacionEsperado')::VARCHAR(2);
    has_contact := COALESCE(NULLIF(trim(candidate->>'telefono'), ''), '') <> ''
      OR COALESCE(NULLIF(trim(candidate->>'whatsapp'), ''), '') <> ''
      OR COALESCE(NULLIF(trim(candidate->>'email'), ''), '') <> '';

    IF candidate_status NOT IN ('VE', 'NV') THEN
      RAISE EXCEPTION 'Estado de verificación inválido para %', candidate->>'razonSocial';
    END IF;
    IF candidate_status = 'VE' AND NOT has_contact THEN
      RAISE EXCEPTION 'Proveedor VE sin contacto: %', candidate->>'razonSocial';
    END IF;
    IF candidate_status = 'VE' AND duplicate_review = 'POSSIBLE_DUPLICATE' THEN
      RAISE EXCEPTION 'Proveedor VE con duplicidad pendiente: %', candidate->>'razonSocial';
    END IF;

    SELECT array_agg(existing."id" ORDER BY existing."id")
    INTO matched_ids
    FROM "UruguayProveedorCoincidencia" existing
    WHERE existing."importKey" = candidate_import_key;

    IF COALESCE(cardinality(matched_ids), 0) = 0 THEN
      SELECT array_agg(existing."id" ORDER BY existing."id")
      INTO matched_ids
      FROM "UruguayProveedorCoincidencia" existing
      WHERE existing."nameKey" = candidate_name_key
        AND existing."locationKey" = candidate_location_key;
    END IF;

    IF COALESCE(cardinality(matched_ids), 0) = 0 AND candidate_address_key <> '' THEN
      SELECT array_agg(existing."id" ORDER BY existing."id")
      INTO matched_ids
      FROM "UruguayProveedorCoincidencia" existing
      WHERE existing."nameKey" = candidate_name_key
        AND existing."addressKey" = candidate_address_key;
    END IF;

    IF COALESCE(cardinality(matched_ids), 0) > 1 THEN
      conflict_count := conflict_count + 1;
      IF jsonb_array_length(conflicts) < 100 THEN
        conflicts := conflicts || jsonb_build_array(jsonb_build_object(
          'razonSocial', candidate->>'razonSocial',
          'ciudad', candidate->>'ciudad',
          'motivo', 'multiples-coincidencias-de-identidad',
          'ids', to_jsonb(matched_ids)
        ));
      END IF;
      CONTINUE;
    END IF;

    IF COALESCE(cardinality(matched_ids), 0) = 1 THEN
      provider_id := matched_ids[1];
      SELECT "codigoProveedor" INTO existing_code
      FROM "Proveedor" WHERE "id" = provider_id FOR UPDATE;

      IF existing_code IS NOT NULL AND existing_code !~ '^UY[0-9]{8}$' THEN
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
        existing_code := 'UY' || lpad(next_number::text, 8, '0');
      END IF;

      evidence := jsonb_build_object(
        'origen', 'Carga auditada Uruguay 2026-09-28',
        'runId', run_id,
        'importKey', candidate_import_key,
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
          'duplicidadRevisada', duplicate_review <> 'POSSIBLE_DUPLICATE'
        ),
        'resultado', candidate_status,
        'revisionDuplicidad', jsonb_build_object(
          'estado', duplicate_review,
          'resultado', 'actualizacion de coincidencia por identidad',
          'metodo', 'evidencia-o-nombre-y-ubicacion',
          'proveedorId', provider_id
        )
      );

      UPDATE "Proveedor"
      SET
        "codigoProveedor" = existing_code,
        "codigoPais" = 'UY',
        "pais" = 'Uruguay',
        "ciudad" = COALESCE(NULLIF(trim("ciudad"), ''), candidate->>'ciudad', 'Uruguay'),
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
        "fechaDiscovery" = COALESCE("fechaDiscovery", NULLIF(candidate->>'fechaDiscovery', '')::date),
        "evidenciaVerificacion" = evidence,
        "activo" = true,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = provider_id;

      updated_count := updated_count + 1;
    ELSE
      next_number := next_number + 1;
      existing_code := 'UY' || lpad(next_number::text, 8, '0');

      evidence := jsonb_build_object(
        'origen', 'Carga auditada Uruguay 2026-09-28',
        'runId', run_id,
        'importKey', candidate_import_key,
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
          'duplicidadRevisada', duplicate_review <> 'POSSIBLE_DUPLICATE'
        ),
        'resultado', candidate_status,
        'revisionDuplicidad', jsonb_build_object(
          'estado', duplicate_review,
          'resultado', 'sin coincidencia de identidad; codigo nuevo',
          'metodo', 'evidencia-o-nombre-y-ubicacion'
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
        existing_code, 'UY', candidate->>'razonSocial', 'Uruguay',
        COALESCE(NULLIF(candidate->>'ciudad', ''), 'Uruguay'),
        NULLIF(candidate->>'direccion', ''), candidate->>'rubro', candidate->>'subrubro',
        candidate->>'productosComercializa', NULLIF(candidate->>'personaContacto', ''),
        NULLIF(candidate->>'website', ''), NULLIF(candidate->>'redesSociales', ''),
        NULLIF(candidate->>'comentarios', ''), NULLIF(candidate->>'email', ''),
        NULLIF(candidate->>'telefono', ''), NULLIF(candidate->>'whatsapp', ''),
        candidate_status,
        CASE WHEN candidate_status = 'VE' THEN CURRENT_TIMESTAMP ELSE NULL END,
        candidate->>'fuenteVerificacion', NULLIF(candidate->>'fechaDiscovery', '')::date,
        evidence, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      RETURNING "id" INTO provider_id;

      created_count := created_count + 1;
    END IF;

    UPDATE "ProveedorRubro"
    SET "esPrincipal" = false, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "proveedorId" = provider_id AND "esPrincipal" = true;

    FOR relation IN SELECT value FROM jsonb_array_elements(candidate->'associations')
    LOOP
      relation_evidence := jsonb_build_object(
        'origen', 'Carga auditada Uruguay 2026-09-28',
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
        provider_id, relation->>'rubro', relation->>'subrubro',
        NULLIF(relation->>'productosComercializa', ''),
        NULLIF(relation->>'fuenteVerificacion', ''), relation_evidence,
        COALESCE((relation->>'esPrincipal')::boolean, false),
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
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
  WHERE "codigoPais" = 'UY';

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
      'posiblesDuplicadosConservados', 74,
      'reglas', jsonb_build_object(
        'codigo', 'UY########',
        'unProveedorUnCodigo', true,
        'multirubro', true,
        'rubroSubrubroSeparados', true,
        'verificadoRequiereContacto', true,
        'verificadoRequiereDuplicidadResuelta', true
      )
    ),
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "runId" = run_id;

  RAISE NOTICE 'URUGUAY_IMPORT_RESULT %', jsonb_build_object(
    'payload', jsonb_array_length(payload),
    'creados', created_count,
    'actualizados', updated_count,
    'conflictos', conflict_count,
    'relaciones', relation_count,
    'VE', verified_count,
    'NV', unverified_count,
    'ultimoCodigo', 'UY' || lpad(next_number::text, 8, '0')
  );
END
$uruguay_import$;
