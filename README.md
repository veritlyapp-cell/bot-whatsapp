# NGR Recruitment Backend - README

Backend microservices para plataforma SaaS multi-tenant de reclutamiento masivo con Bot de WhatsApp impulsado por IA.

## 🚀 Características

- **Bot de WhatsApp con IA**: Conversación inteligente usando Google Gemini
- **Multi-tenant**: Soporte para múltiples marcas (Papa Johns, Bembos, Dunkin, etc.)
- **Validación automática**: DNI, edad, disponibilidad horaria
- **Matching geográfico**: Sugerencias de tiendas basadas en distrito
- **Programación de entrevistas**: Sistema automatizado de agendamiento
- **Recordatorios**: Confirmaciones automáticas 24h antes de entrevistas
- **API REST**: Endpoints para integración con dashboard admin

## 📋 Requisitos

- Node.js 18+
- Firebase Project con Firestore
- Google Gemini API Key

## ⚙️ Configuración

1. **Instalar dependencias**:
```bash
npm install
```

2. **Configurar variables de entorno**:
Copia `.env.example` a `.env` y completa:
```env
GOOGLE_GEMINI_API_KEY=tu_api_key_aqui
FIREBASE_PROJECT_ID=tu_proyecto_firebase
FIREBASE_PRIVATE_KEY="tu_private_key"
FIREBASE_CLIENT_EMAIL=tu_client_email
PORT=3000
```

3. **Cargar datos iniciales**:
```bash
npm run load-data
```

## 🎮 Uso

### Servidor API
```bash
npm start           # Producción
npm run dev         # Desarrollo con auto-reload
```

### Simulador de WhatsApp
```bash
npm run simulator
```

Prueba el chatbot de forma interactiva sin necesidad de WhatsApp Business API.

## 🔌 API Endpoints

- `GET /health` - Health check
- `POST /api/chat` - Procesar mensaje de WhatsApp
- `GET /api/candidates/:marcaId` - Listar candidatos por marca
- `GET /api/vacancies/:marcaId` - Listar vacantes activas
- `GET /api/conversations/:phone` - Detalle de conversación

## 📊 Estructura de Firestore

```
marcas/
  {marcaId}/
    tiendas/
      {tiendaId}/
        vacantes/
          {vacanteId}
    postulantes/
      {postulanteId}

conversaciones/
  {phone}
```

## 🤖 Flujo de Conversación

1. **Inicio**: Saludo y solicitud de nombre
2. **Datos básicos**: DNI, fecha de nacimiento, distrito, disponibilidad
3. **Validación**: Verificación de requisitos
4. **Tiendas**: Sugerencias basadas en ubicación
5. **Vacantes**: Selección de puesto
6. **Entrevista**: Programación de fecha/hora
7. **Confirmación**: Recordatorio automático

## 📝 Comandos del Simulador

- `/reset` - Reiniciar conversación
- `/phone` - Cambiar número de teléfono
- `/exit` - Salir del simulador

## 🔐 Seguridad

- Helmet para headers HTTP seguros
- CORS habilitado
- Validación de inputs
- Firebase Admin SDK para autenticación

## 📄 Licencia

MIT
