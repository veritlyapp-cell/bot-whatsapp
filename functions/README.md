# Cloud Functions - Alertas de RQs sin Cubrir

## Descripción

Esta Cloud Function revisa diariamente los RQs que llevan más de 7 días sin cubrirse y envía alertas por email a los recruiters asignados.

## Funciones

### `checkUnfilledRQs`
- **Tipo:** Scheduled (Pub/Sub)
- **Horario:** Todos los días a las 8:00 AM (hora de Lima)
- **Acción:** 
  1. Consulta RQs activos y aprobados
  2. Identifica los que tienen 7+ días sin cubrir
  3. Actualiza el campo `alert_unfilled = true`
  4. Envía emails a los recruiters asignados a cada marca

### `triggerUnfilledCheck`
- **Tipo:** HTTP
- **Uso:** Endpoint para disparar la verificación manualmente (testing)
- **Autenticación:** Requiere Bearer token

## Configuración

### Variables de Entorno
Configura estas variables en Firebase Functions:

```bash
firebase functions:config:set resend.api_key="tu-api-key"
firebase functions:config:set app.url="https://liah.app"
```

### Instalación

```bash
cd functions
npm install
```

### Deploy

```bash
# Deploy solo functions
firebase deploy --only functions

# Deploy función específica
firebase deploy --only functions:checkUnfilledRQs
```

### Testing Local

```bash
cd functions
npm run serve
```

## Notas

- La función usa el mismo servicio de Resend configurado en el frontend
- Los emails se envían a recruiters que tengan la marca asignada en `assignedMarcas`
- El campo `alert_unfilled` se usa para mostrar el badge visual en el frontend
