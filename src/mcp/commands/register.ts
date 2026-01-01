import chalk from 'chalk';
import * as inquirer from '@inquirer/prompts';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function registerAction(tool?: string) {
  const configPath =
    process.platform === 'win32'
      ? path.join(
          process.env.APPDATA || '',
          'Claude',
          'claude_desktop_config.json',
        )
      : path.join(
          os.homedir(),
          'Library',
          'Application Support',
          'Claude',
          'claude_desktop_config.json',
        );

  const mcpConfig = {
    mcpServers: {
      modjules: {
        command: 'npx',
        args: ['-y', '--package', 'modjules', 'modjules-mcp'],
      },
    },
  };

  const printConfig = (name: string, json: any) => {
    console.log(chalk.bold(`\nConfiguration for ${name}:`));
    console.log(chalk.dim('Add this to your MCP configuration file:'));
    console.log(chalk.cyan(JSON.stringify(json, null, 2)));
  };

  if (!tool || tool === 'cursor') {
    printConfig('Cursor', mcpConfig);
  }

  if (!tool || tool === 'gemini') {
    console.log(
      chalk.bold('\nConfiguration for Antigravity (.gemini/modules.json):'),
    );
    console.log(
      chalk.dim('Add this to your .gemini/modules.json global config:'),
    );
    console.log(
      chalk.cyan(
        JSON.stringify(
          {
            modules: {
              modjules: {
                command: 'npx',
                args: ['-y', '--package', 'modjules', 'modjules-mcp'],
              },
            },
          },
          null,
          2,
        ),
      ),
    );
  }

  if (!tool || tool === 'claude') {
    printConfig('Claude Desktop', mcpConfig);

    if (tool === 'claude') {
      // Only offer auto-install if specifically asked for 'claude' to avoid noise in 'register' (all)
      try {
        const shouldInstall = await inquirer.confirm({
          message: `Do you want to automatically add this to ${configPath}?`,
          default: false,
        });

        if (shouldInstall) {
          let currentConfig: any = { mcpServers: {} };
          if (fs.existsSync(configPath)) {
            try {
              currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            } catch {
              console.warn(
                chalk.yellow(
                  'Existing config file is invalid, creating new one.',
                ),
              );
            }
          }

          currentConfig.mcpServers = {
            ...currentConfig.mcpServers,
            ...mcpConfig.mcpServers,
          };

          fs.mkdirSync(path.dirname(configPath), { recursive: true });
          fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));
          console.log(chalk.green(`✓ Successfully updated ${configPath}`));
        }
      } catch (e) {
        // Ignore prompts errors or file errors, just log
        console.error(chalk.red('Could not write config file'), e);
      }
    }
  }
}
