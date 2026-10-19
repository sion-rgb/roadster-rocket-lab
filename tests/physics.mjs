import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['--import','tsx','tests/physics.ts'],{stdio:'inherit'});process.exit(result.status??1);
