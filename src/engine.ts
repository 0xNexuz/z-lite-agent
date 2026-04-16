import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';

const execPromise = util.promisify(exec);

export async function getPortfolio(userId: string, privateKey: string, address: string) {
    console.log(`[ENGINE] Fetching live onchain portfolio for User ${userId}...`);

    try {
        const cliPath = path.resolve(__dirname, '../../zerion-ai');
        let runner = 'node';
        let targetFile = '';

        // Dynamically find the executable
        if (fs.existsSync(path.join(cliPath, 'src/index.ts'))) { runner = 'npx tsx'; targetFile = 'src/index.ts'; }
        else if (fs.existsSync(path.join(cliPath, 'cli/zerion-cli.js'))) { targetFile = 'cli/zerion-cli.js'; }
        else if (fs.existsSync(path.join(cliPath, 'bin/cli.js'))) { targetFile = 'bin/cli.js'; }
        else if (fs.existsSync(path.join(cliPath, 'index.js'))) { targetFile = 'index.js'; }
        else return null;

        const executionEnv = {
            ...process.env, 
            WALLET_PRIVATE_KEY: privateKey,
            EVM_PRIVATE_KEY: privateKey,
            ZERION_API_KEY: process.env.ZERION_API_KEY || ''
        };

        const command = `${runner} ${targetFile} wallet portfolio ${address}`;
        
        const { stdout } = await execPromise(command, { cwd: cliPath, env: executionEnv });
        
        // Find the JSON block in the output (in case CLI prints warnings before the JSON)
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return null;

    } catch (error: any) {
        console.error(`[ENGINE] Failed to fetch portfolio: ${error.message}`);
        return null;
    }
}