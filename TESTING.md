# 🧪 Guía de Testing - Sistema Multi-Tenant

## Pre-requisitos

1. ✅ Configurar `.env` con tus credenciales:
```bash
GOOGLE_GEMINI_API_KEY=tu_clave_aqui
FIREBASE_PROJECT_ID=tu_proyecto
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=tu_email@tu_proyecto.iam.gserviceaccount.com
PORT=3000
NODE_ENV=development
```

---

## Paso 1: Cargar Datos Iniciales

```bash
npm run load-data
```

**Qué hace:**
- ✅ Crea 7 tenants (Papa Johns, Bembos, Dunkin, Popeyes, Don Belisario, Chinawok, SR)
- ✅ Carga tiendas desde `maestra_tiendas.json` bajo cada tenant
- ✅ Carga vacantes desde `requerimientos_quincenales.csv` bajo cada tienda

**Resultado esperado:**
```
✅ Successfully loaded 7 tenants
✅ Successfully loaded 12 stores
✅ Successfully loaded 23 vacancies
```

---

## Paso 2: Crear Usuarios Admin

```bash
npm run create-admins
```

**Qué hace:**
- ✅ Crea un usuario admin para cada tenant
- ✅ Configura custom claims (tenant_id + role)
- ✅ Muestra credenciales generadas

**Credenciales creadas:**
```
admin@papajohns.pe      / PapaJohns2024!      (ngr_papajohns)
admin@bembos.pe         / Bembos2024!         (ngr_bembos)
admin@dunkin.pe         / Dunkin2024!         (ngr_dunkin)
admin@popeyes.pe        / Popeyes2024!        (ngr_popeyes)
admin@donbelisario.pe   / DonBelisario2024!   (ngr_donbelisario)
admin@chinawok.pe       / Chinawok2024!       (ngr_chinawok)
admin@sr.pe             / SR2024!             (ngr_sr)
```

---

## Paso 3: Iniciar Servidor

```bash
npm start
```

**Resultado esperado:**
```
🚀 Multi-Tenant Server running on port 3000
📡 Public endpoints:
   GET    /health
   POST   /api/auth/login
   POST   /api/chat (origin_id required)
🔐 Protected endpoints (require authentication):
   GET    /api/auth/me
   ...
```

---

## Paso 4: Testing del Sistema

### A) Test de Autenticación

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@papajohns.pe",
    "password": "PapaJohns2024!"
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "uid": "abc123...",
    "email": "admin@papajohns.pe",
    "nombre": "Admin Papa Johns",
    "tenant_id": "ngr_papajohns",
    "role": "admin"
  }
}
```

**Guardar el token:**
```bash
# PowerShell
$token = "tu_token_aqui"
```

---

### B) Test de Configuración de Tenant

**Obtener branding:**
```bash
curl -X GET http://localhost:3000/api/tenant/config \
  -H "Authorization: Bearer $token"
```

**Respuesta esperada:**
```json
{
  "success": true,
  "config": {
    "tenant_id": "ngr_papajohns",
    "nombre": "Papa Johns Peru",
    "logo": "https://www.papajohns.com.pe/static/images/logo.png",
    "colores": {
      "primary": "#00A24D",
      "secondary": "#E31837",
      "accent": "#FFD100"
    },
    "contacto": {
      "email": "rrhh@papajohns.pe",
      "telefono": "987111000"
    }
  }
}
```

---

### C) Test de Bot con Origin ID

**Enviar mensaje como Papa Johns:**
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "987654321",
    "message": "Hola, quiero trabajar",
    "origin_id": "whatsapp_papajohns"
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "phone": "987654321",
  "response": "¡Hola! 👋 Soy tu asistente de reclutamiento de NGR...",
  "state": "datos_basicos",
  "tenant_id": "ngr_papajohns"
}
```

**Enviar mensaje como Bembos (diferente tenant):**
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "987654322",
    "message": "Hola",
    "origin_id": "whatsapp_bembos"
  }'
```

✅ **Validación:** El `tenant_id` en la respuesta debe ser `ngr_bembos`

---

### D) Test de Aislamiento de Datos

**1. Login como Papa Johns:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@papajohns.pe", "password": "PapaJohns2024!"}'
```

**2. Obtener candidatos (debe ver solo de Papa Johns):**
```bash
curl -X GET http://localhost:3000/api/candidates \
  -H "Authorization: Bearer $token_papajohns"
```

**3. Login como Bembos:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@bembos.pe", "password": "Bembos2024!"}'
```

**4. Obtener candidatos (debe ver solo de Bembos):**
```bash
curl -X GET http://localhost:3000/api/candidates \
  -H "Authorization: Bearer $token_bembos"
```

✅ **Validación:** Cada usuario solo ve datos de su tenant

---

### E) Test con Simulador Interactivo

**Iniciar simulador:**
```bash
npm run simulator
```

**Flujo interactivo:**
```
📋 Tenants disponibles:

   1. Papa Johns Peru (ngr_papajohns)
      Origin ID: whatsapp_papajohns

   2. Bembos (ngr_bembos)
      Origin ID: whatsapp_bembos
   ...

Selecciona un tenant (número): 1

📱 Ingresa número de teléfono: 987654321

╔════════════════════════════════════════════════╗
║  Tenant: ngr_papajohns                        ║
║  Phone:  987654321                            ║
╚════════════════════════════════════════════════╝

💬 Conversación iniciada. Escribe "salir" para terminar.

👤 Tú: Hola
⏳ Procesando mensaje...

🤖 BOT:
¡Hola! 👋 Soy tu asistente de reclutamiento de NGR...

📊 Estado: datos_basicos

👤 Tú: Me llamo Juan Pérez
...
```

---

### F) Test de Vacantes por Tenant

**Obtener vacantes de Papa Johns:**
```bash
curl -X GET http://localhost:3000/api/vacancies \
  -H "Authorization: Bearer $token_papajohns"
```

**Resultado:** Solo vacantes de tiendas Papa Johns

---

### G) Test de Tiendas

**Listar tiendas del tenant:**
```bash
curl -X GET http://localhost:3000/api/stores \
  -H "Authorization: Bearer $token"
```

---

## Validaciones de Seguridad

### ❌ Test: Intento de acceso cross-tenant

```bash
# Login como Papa Johns
# Intentar acceder a conversación de otro tenant usando token de Papa Johns
curl -X GET http://localhost:3000/api/conversations/999888777 \
  -H "Authorization: Bearer $token_papajohns"
```

**Resultado esperado:**
```json
{
  "error": "Forbidden",
  "message": "Access to this conversation is not allowed"
}
```

### ❌ Test: Endpoint sin autenticación

```bash
curl -X GET http://localhost:3000/api/candidates
```

**Resultado esperado:**
```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid Authorization header"
}
```

---

## Checklist de Testing Completo

- [ ] ✅ Datos cargados (`npm run load-data`)
- [ ] ✅ Usuarios admin creados (`npm run create-admins`)
- [ ] ✅ Servidor iniciado correctamente
- [ ] ✅ Login exitoso para al menos 2 tenants
- [ ] ✅ Obtener configuración de tenant (logo, colores)
- [ ] ✅ Bot responde con origin_id correcto
- [ ] ✅ Aislamiento de datos verificado (candidatos, vacantes)
- [ ] ✅ Simulador funciona correctamente
- [ ] ✅ Cross-tenant access bloqueado
- [ ] ✅ Endpoints sin auth retornan 401

---

## Troubleshooting

### Error: "Tenant not found"
- Verifica que ejecutaste `npm run load-data`
- Revisa que el `origin_id` sea correcto en `/api/chat`

### Error: "Invalid credentials"
- Verifica que ejecutaste `npm run create-admins`
- Usa las credenciales exactas mostradas en el output

### Error: "Missing or invalid Authorization header"
- Asegúrate de incluir `Authorization: Bearer <token>`
- El token debe ser el obtenido de `/api/auth/login`

### Error en Firebase
- Verifica `.env` tiene todas las credenciales
- El `FIREBASE_PRIVATE_KEY` debe tener `\n` literales (dentro de comillas)

---

## Próximos Pasos

1. **Dashboard Frontend:**
   - Implementar login con `POST /api/auth/login`
   - Aplicar branding desde `GET /api/tenant/config`
   - Mostrar datos con token de autenticación

2. **WhatsApp Business API:**
   - Configurar webhooks para cada tenant
   - Mapear webhook URL → `origin_id`
   - Enviar mensajes a `POST /api/chat` con `origin_id`

3. **Monitoreo:**
   - Logs centralizados por tenant
   - Métricas de conversaciones por tenant
   - Alertas de errores

¡Sistema listo para producción! 🚀
