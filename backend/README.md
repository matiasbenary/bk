# Backend

Express.js API with TypeScript, SQLite, and payment integrations.

## Setup

1. Install dependencies:
   ```bash
   yarn install
   ```

2. Copy `.env.example` to `.env` and configure your environment variables.

3. Run development server:
   ```bash
   yarn dev
   ```

## Scripts

- `yarn dev` - Start development server with hot reload
- `yarn build` - Build for production
- `yarn start` - Run production build

## Environment Variables

See `.env.example` for required configuration including:
- Stripe keys
- Google OAuth credentials
- JWT secret
- HotPay (crypto payments) settings
