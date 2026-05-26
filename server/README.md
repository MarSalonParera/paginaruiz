# Backend para Paginaruiz

Este backend proporciona autenticación (registro/login, Google OAuth opcional), almacenamiento de carrito por usuario, creación de pedidos y soporte para pagos con Stripe.

Requisitos:
- Node.js 18+

Instalación:

```bash
cd server
npm install
cp .env.example .env
# Edita .env y añade tus claves: SESSION_SECRET, GOOGLE_CLIENT_ID/SECRET, STRIPE keys
npm run dev
```

Rutas importantes:
- `POST /api/signup` {name,email,password}
- `POST /api/login` {email,password}
- `POST /api/logout`
- `GET /api/me`
- `GET /api/cart` - obtiene cesta del usuario (o guest)
- `POST /api/cart` {items: []} - guarda cesta
- `POST /api/create-payment-intent` {items: []} - crea PaymentIntent (Stripe)
- `POST /api/orders` {items, total, paymentId} - crea pedido en DB
- `POST /webhook` - endpoint para webhooks de Stripe (configurar STRIPE_WEBHOOK_SECRET)

Notas de despliegue:
- Usa HTTPS en producción.
- Configura variables de entorno de forma segura.
- Para producción considera Postgres en vez de SQLite y ajustar la sesión store.
