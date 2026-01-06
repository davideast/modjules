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
        args: ['-y', '--package', '@modjules/mcp', 'modjules-mcp'],
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
    const geminiConfigPath = path.join(
      os.homedir(),
      '.gemini',
      'antigravity',
      'mcp_config.json',
    );

    const geminiConfig = {
      mcpServers: {
        modjules: {
          command: 'npx',
          args: ['-y', '--package', '@modjules/mcp', 'modjules-mcp'],
          env: {
            HOME: os.homedir(),
            JULES_API_KEY: '<YOUR_API_KEY>',
          },
        },
      },
    };

    console.log(
      chalk.bold(`\nConfiguration for Antigravity (${geminiConfigPath}):`),
    );
    console.log(chalk.dim('Add this to your global Antigravity MCP config:'));
    console.log(chalk.cyan(JSON.stringify(geminiConfig, null, 2)));
    console.log(
      chalk.yellow('\n⚠️  Replace <YOUR_API_KEY> with your Jules API key'),
    );

    // Add auto-install option for gemini (same as claude)
    if (tool === 'gemini') {
      try {
        const shouldInstall = await inquirer.confirm({
          message: `Do you want to automatically add this to ${geminiConfigPath}?`,
          default: false,
        });

        if (shouldInstall) {
          const apiKey = await inquirer.input({
            message: 'Enter your Jules API key:',
          });

          geminiConfig.mcpServers.modjules.env.JULES_API_KEY = apiKey;

          let currentConfig: any = { mcpServers: {} };
          if (fs.existsSync(geminiConfigPath)) {
            try {
              currentConfig = JSON.parse(
                fs.readFileSync(geminiConfigPath, 'utf-8'),
              );
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
            ...geminiConfig.mcpServers,
          };

          fs.mkdirSync(path.dirname(geminiConfigPath), { recursive: true });
          fs.writeFileSync(
            geminiConfigPath,
            JSON.stringify(currentConfig, null, 2),
          );
          console.log(
            chalk.green(`✓ Successfully updated ${geminiConfigPath}`),
          );
        }
      } catch (e) {
        console.error(chalk.red('Could not write config file'), e);
      }
    }
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
