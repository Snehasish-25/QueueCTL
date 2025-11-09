
import handleCLI from '../src/routes/cli.js';

try {
  const args = process.argv.slice(2);
  await handleCLI(args);
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
