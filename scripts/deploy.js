import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { rmSync } from 'node:fs';

console.log('📦 Construyendo proyecto con Vite...');
execSync('npm run build', { stdio: 'inherit' });

console.log('🚀 Desplegando en la rama gh-pages...');
const gitIndex = resolve('.git', 'temp_deploy_index');
process.env.GIT_INDEX_FILE = gitIndex;

try {
  execSync('git --work-tree=dist add --all', { stdio: 'inherit' });
  const tree = execSync('git write-tree').toString().trim();
  const commit = execSync(`git commit-tree ${tree} -p origin/gh-pages -m "Updates"`).toString().trim();
  execSync(`git push origin ${commit}:refs/heads/gh-pages`, { stdio: 'inherit' });
  console.log('✅ ¡Despliegue a gh-pages completado con éxito!');
} catch (error) {
  console.error('❌ Error al desplegar en gh-pages:', error.message);
  process.exit(1);
} finally {
  delete process.env.GIT_INDEX_FILE;
  try {
    rmSync(gitIndex, { force: true });
  } catch (_) {}
}
