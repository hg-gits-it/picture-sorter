if (process.env.NODE_ENV === 'production') {
  const { config } = await import('dotenv');
  config({ path: '/mnt/data/.env.production' });
}
