#!/usr/bin/env node

import { program } from 'commander';
import setup from './cli/setup';
import remove from './cli/remove';
import flash from './cli/flash';
import run from './cli/run';
import createProject from './cli/create-project';

const root = program
              .version('')
              .description('')

root.command('setup')
  .description('setup environment for the specified device')
  .argument('<device>', 'device to setup')
  .action(async (device) => {
    await setup(device);
  });

root.command('remove')
  .description('remove environment for the specified device')
  .argument('<device>', 'device to remove')
  .action((device) => {
    remove(device);
  });

root.command('flash')
  .description('flash runtime to the specified device')
  .argument('<device>', 'device to flash runtime')
  .option('-p, --port <port>', 'serial port')
  .action(async (device, options: { port: string })=>{
    await flash(device, options.port);
  });

root.command('create-project')
  .description('create a project')
  .argument('<name>', 'project name')
  .action((name: string)=>{
    createProject(name);
  });

root.command('install')
  .description('install a package')
  .argument('<name>', 'package name')
  .action((name: string)=>{
    
  });

root.command('run')
  .description('run BlueScript code')
  .action(async () => {
    await run();
  })

program.parse(process.argv);