#!/usr/bin/env node

import { program } from 'commander';
import setup from './setup';
import remove from './remove';
import flash from './flash';
import run from './run';
import createProject from './create-project';

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
  .description('flash firmware to the specified device')
  .argument('<device>', 'device to flash firmware')
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

root.command('run')
  .description('run BlueScript code')
  .action(async () => {
    await run();
  })

program.parse(process.argv);