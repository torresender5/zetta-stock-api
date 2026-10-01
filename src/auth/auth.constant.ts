const FALLBACK_JWT_SECRET = 'e9cb7f51-4dcb-46ba-b47f-e77c9b5c7073';

export const jwtConstants = {
  /** Se lee en cada uso para que esté disponible tras cargar .env. */
  get secret(): string {
    return process.env.JWT_SECRET || FALLBACK_JWT_SECRET;
  },
};
