import { build } from 'bun';

async function runBuild() {
  await build({
    entrypoints: ['./src/main.ts'],
    outdir: './dist',
    target: 'node',
    external: [
      '@nestjs/microservices/*',
      '@nestjs/platform-socket.io',
      'amqplib',
      'amqp-connection-manager',
      'ioredis',
      'kafkajs',
      'mqtt',
      'nats',
      '@grpc/grpc-js',
      '@grpc/proto-loader',
    ],
    minify: true,
  });

  console.log('Build completed successfully!');
}

runBuild().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
