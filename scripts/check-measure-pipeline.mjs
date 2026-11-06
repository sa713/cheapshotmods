import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {URL} from 'node:url';
import {spawnSync} from 'node:child_process';
import process from 'node:process';
import {log} from 'node:console';

// Execute the actual workflow step, rather than supplying pipefail in the
// probe shell. This also detects removing the protection from the workflow.
const workflow=readFileSync(new URL('../.github/workflows/verify.yml',import.meta.url),'utf8');
const match=workflow.match(/^ {6}- name: Measure capacity\n {8}run: \|\n((?: {10}.*\n)+)/m);
assert.ok(match,'Cannot locate the measurement step');
const step=match[1].split('\n').filter(line=>line.length).map(line=>line.slice(10)).join('\n')+'\n';
const dir=mkdtempSync(join(tmpdir(),'chm-pipeline-'));
const env={...process.env};delete env.SHELLOPTS;delete env.BASHOPTS;
try {
  writeFileSync(join(dir,'package.json'),JSON.stringify({private:true,scripts:{measure:'node -e "process.exit(17)"'}}));
  const execute=script=>{
    writeFileSync(join(dir,'step.sh'),script);
    return spawnSync('bash',['--noprofile','--norc','-e','step.sh'],{cwd:dir,env,encoding:'utf8',timeout:30000});
  };
  const protectedStep=execute(step);
  assert.equal(protectedStep.status,17,protectedStep.stderr||'Measurement failure was hidden');
  // Negative control: the same step without its explicit setting hides failure
  // under the default shell, so workflow defaults cannot account for this pass.
  const unprotectedStep=execute(step.replace('set -o pipefail\n',''));
  assert.equal(unprotectedStep.status,0,'Probe shell unexpectedly supplied pipefail');
  log(JSON.stringify({measurementFailureProbe:'passed',source:'actual workflow step',workflowDefaults:false,exitCode:protectedStep.status,withoutProtectionExitCode:unprotectedStep.status}));
} finally {rmSync(dir,{recursive:true,force:true});}
